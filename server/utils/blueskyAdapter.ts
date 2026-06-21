import { Agent, CredentialSession } from "@atproto/api";
import type {
  AppBskyFeedDefs,
  AppBskyEmbedImages,
  AppBskyEmbedExternal,
} from "@atproto/api";
import type { NewFeedItem } from "./rssAdapter";

export const BLUESKY_SOURCE = "bluesky" as const;

// Posts longer than this many characters get truncated for the title derivation.
const TITLE_MAX_CHARS = 100;

// Bluesky limits timeline pages to 100 posts; use a safe default.
const PAGE_LIMIT = 50;

export interface BlueskyCredentials {
  identifier: string;
  appPassword: string;
  accessJwt: string;
  refreshJwt: string;
  did: string;
}

export interface BlueskyAdapterDeps {
  createSession: (_credentials: BlueskyCredentials) => Promise<Agent>;
  getTimeline: (
    _agent: Agent,
    _cursor?: string,
  ) => Promise<{ feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string }>;
}

export interface PostFilterPolicy {
  includeReposts: boolean;
  includeReplies: boolean;
}

// Default policy: top-level original posts only.
// Reposts and replies are excluded to keep the feed signal-dense.
// Override per-feed by passing a custom policy.
export const DEFAULT_POST_FILTER_POLICY: PostFilterPolicy = {
  includeReposts: false,
  includeReplies: false,
};

// Exported for unit testing.
export function buildPermalinkFromUri(handle: string, uri: string): string {
  // AT URI format: at://did:plc:<id>/app.bsky.feed.post/<rkey>
  const rkey = uri.split("/").at(-1) ?? "";
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

// Exported for unit testing.
export function deriveTitleFromText(text: string): string {
  if (!text) {
    return "(untitled)";
  }

  const firstLine = text.split("\n")[0] ?? "";
  const candidate = firstLine.length > 0 ? firstLine : text;

  if (candidate.length <= TITLE_MAX_CHARS) {
    return candidate;
  }

  return candidate.slice(0, TITLE_MAX_CHARS) + "…";
}

// Exported for unit testing.
export function resolvePostImageUrl(
  post: AppBskyFeedDefs.FeedViewPost["post"],
): string | null {
  const embed = post.embed;
  if (!embed) {
    return null;
  }

  if (embed.$type === "app.bsky.embed.images#view") {
    const imagesEmbed = embed as AppBskyEmbedImages.View;
    const firstImage = imagesEmbed.images?.[0];
    return firstImage?.thumb ?? null;
  }

  if (embed.$type === "app.bsky.embed.external#view") {
    const externalEmbed = embed as AppBskyEmbedExternal.View;
    return externalEmbed.external?.thumb ?? null;
  }

  return null;
}

function isRepost(feedPost: AppBskyFeedDefs.FeedViewPost): boolean {
  return feedPost.reason?.$type === "app.bsky.feed.defs#reasonRepost";
}

function isReply(feedPost: AppBskyFeedDefs.FeedViewPost): boolean {
  const record = feedPost.post.record as Record<string, unknown> | null;
  return record?.reply != null;
}

// Exported for unit testing.
export function shouldIncludePost(
  feedPost: AppBskyFeedDefs.FeedViewPost,
  policy: PostFilterPolicy,
): boolean {
  if (!policy.includeReposts && isRepost(feedPost)) {
    return false;
  }

  if (!policy.includeReplies && isReply(feedPost)) {
    return false;
  }

  return true;
}

function mapPostToFeedItem(
  feedPost: AppBskyFeedDefs.FeedViewPost,
  feedId: number,
): NewFeedItem {
  const post = feedPost.post;
  const record = post.record as {
    text?: string;
    createdAt?: string;
    reply?: unknown;
  };

  const author = post.author;
  const handle = author.handle;
  const displayName = author.displayName ?? handle;
  const uri = post.uri;
  const text = record.text ?? "";
  const createdAt = record.createdAt;
  const publishedAt = createdAt ? new Date(createdAt) : null;

  return {
    feedId,
    guid: uri,
    title: deriveTitleFromText(text),
    url: buildPermalinkFromUri(handle, uri),
    author: displayName,
    content: text || null,
    imageUrl: resolvePostImageUrl(post),
    publishedAt,
    savedAt: new Date(),
    readAt: null,
    starred: false,
    tags: null,
    searchVector: null,
  };
}

function isPostAfterWatermark(
  feedPost: AppBskyFeedDefs.FeedViewPost,
  watermark: Date,
): boolean {
  const record = feedPost.post.record as { createdAt?: string };
  if (!record.createdAt) {
    return true;
  }

  const postDate = new Date(record.createdAt);
  return postDate > watermark;
}

export async function createAgentSession(
  credentials: BlueskyCredentials,
): Promise<Agent> {
  const session = new CredentialSession(new URL("https://bsky.social"));

  try {
    await session.resumeSession({
      did: credentials.did,
      handle: credentials.identifier,
      accessJwt: credentials.accessJwt,
      refreshJwt: credentials.refreshJwt,
      active: true,
    });
  } catch {
    // Tokens expired or invalid — fall back to full re-auth with app password.
    await session.login({
      identifier: credentials.identifier,
      password: credentials.appPassword,
    });
  }

  return new Agent(session);
}

export async function fetchTimelinePage(
  agent: Agent,
  cursor?: string,
): Promise<{ feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string }> {
  const response = await agent.getTimeline({
    limit: PAGE_LIMIT,
    cursor,
  });

  return {
    feed: response.data.feed,
    cursor: response.data.cursor,
  };
}

export async function fetchNewBlueskyPosts(
  credentials: BlueskyCredentials,
  feedId: number,
  lastSyncedAt: Date | null,
  policy: PostFilterPolicy = DEFAULT_POST_FILTER_POLICY,
  deps: BlueskyAdapterDeps = {
    createSession: createAgentSession,
    getTimeline: fetchTimelinePage,
  },
): Promise<NewFeedItem[]> {
  const agent = await deps.createSession(credentials);
  const items: NewFeedItem[] = [];
  let cursor: string | undefined;

  // If no watermark, use the epoch so everything is included (first sync).
  const watermark = lastSyncedAt ?? new Date(0);

  while (true) {
    const page = await deps.getTimeline(agent, cursor);

    if (page.feed.length === 0) {
      break;
    }

    let reachedWatermark = false;

    for (const feedPost of page.feed) {
      if (!isPostAfterWatermark(feedPost, watermark)) {
        reachedWatermark = true;
        break;
      }

      if (!shouldIncludePost(feedPost, policy)) {
        continue;
      }

      items.push(mapPostToFeedItem(feedPost, feedId));
    }

    if (reachedWatermark || !page.cursor) {
      break;
    }

    cursor = page.cursor;
  }

  return items;
}
