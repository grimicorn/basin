import type { CustomAsyncWorkloadEvent } from "@netlify/async-workloads";

export type SyncMode = "scheduled" | "on-demand";

export interface SyncFeedEventData {
  userId: number;
  feedId: number;
  sourceType: "rss" | "podcast" | "youtube";
  mode: SyncMode;
}

export interface SyncFeedEvent extends CustomAsyncWorkloadEvent {
  eventName: "sync-feed";
  eventData: SyncFeedEventData;
}

export const SYNC_FEED_EVENT_NAME = "sync-feed" as const;

export const DEBOUNCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export const MAX_ITEMS_PER_SYNC = 50;
