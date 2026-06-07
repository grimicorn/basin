import { config } from "@vue/test-utils";
import { vi } from "vitest";

// Real composables as globals — mirrors Nuxt's auto-import behavior.
// useToast first: it has no deps and useFeed calls useToast() as a global.
import { useToast } from "../app/composables/useToast.js";
import { useSearch } from "../app/composables/useSearch.js";
import { useAppearance } from "../app/composables/useAppearance.js";
import { useFeed } from "../app/composables/useFeed.js";

globalThis.useToast = useToast;
globalThis.useSearch = useSearch;
globalThis.useAppearance = useAppearance;
globalThis.useFeed = useFeed;

// Nuxt router / navigation globals
globalThis.navigateTo = vi.fn();
globalThis.useRoute = vi.fn(() => ({ path: "/", params: {}, query: {} }));
globalThis.useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));
globalThis.definePageMeta = vi.fn();

// Nuxt / Nitro handler wrappers — identity so the inner function is what gets exported
globalThis.defineNuxtRouteMiddleware = (fn: Function) => fn;
globalThis.defineEventHandler = (fn: Function) => fn;

// H3 / Nitro server globals used by API handlers under test
globalThis.createError = ({
  statusCode,
  statusMessage,
}: {
  statusCode: number;
  statusMessage: string;
}) => Object.assign(new Error(statusMessage), { statusCode });
globalThis.readBody = (event: any) => Promise.resolve(event.body ?? {});
globalThis.getRouterParam = (event: any, name: string) => event.params?.[name];

// Vue composition API — mirrors Nuxt's auto-import so components can use
// ref/computed/watch/etc. without explicit imports.
import { ref, computed, watch, onMounted } from "vue";
globalThis.ref = ref;
globalThis.computed = computed;
globalThis.watch = watch;
globalThis.onMounted = onMounted;

// Clerk composable stubs
const mockClerkUser = ref({
  firstName: "Demo",
  lastName: "User",
  fullName: "Demo User",
  primaryEmailAddress: { emailAddress: "demo@example.com" },
  imageUrl: "",
});
globalThis.useUser = () => ({ user: computed(() => mockClerkUser.value) });
globalThis.useClerk = () => ({ signOut: vi.fn() });
globalThis.useAuth = vi.fn(() => ({
  isSignedIn: ref(false),
  getToken: { value: vi.fn().mockResolvedValue(null) },
}));

// Global stubs — covers Nuxt built-ins, Vue Transition, and every app
// component that Nuxt auto-imports. Registering them here lets Vue resolve
// the names cleanly instead of emitting "Failed to resolve component" warnings.
config.global.stubs = {
  // Nuxt built-ins
  NuxtLink: {
    props: ["to"],
    template: '<a :href="to"><slot /></a>',
  },
  NuxtLayout: {
    template: "<div><slot /></div>",
  },
  NuxtPage: {
    template: "<div />",
  },
  // Stub Transition so v-if content inside renders synchronously in tests
  Transition: {
    template: "<div><slot /></div>",
  },
  // App components (Nuxt auto-imports) — true renders as <component-stub>
  RIcon: true,
  RLogo: true,
  AppHeader: true,
  AppToast: true,
  SearchOverlay: true,
  ReaderDetail: true,
  SourceTag: true,
  CardActions: true,
  SkeletonCard: true,
  FeedItem: true,
  ArticleCard: true,
  VideoCard: true,
  PodcastCard: true,
  TweetCard: true,
  PhotoCard: true,
  AvatarButton: true,
  SettingsFeeds: true,
  SettingsConnections: true,
  SettingsReading: true,
  SettingsAccount: true,
};
