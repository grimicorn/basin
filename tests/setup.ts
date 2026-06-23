import { config } from "@vue/test-utils";
import { vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Real composables as globals — mirrors Nuxt's auto-import behavior.
import { useToast } from "../app/composables/useToast.js";
import { useSearch } from "../app/composables/useSearch.js";
import { USER_SETTINGS_DEFAULTS } from "../app/composables/useUserSettings.ts";
import { useAppearanceStore } from "../app/stores/appearance.ts";
import { useFeedStore } from "../app/stores/feed.ts";
import { useInputValidation } from "../app/composables/useInputValidation.ts";

globalThis.useToast = useToast;
globalThis.useSearch = useSearch;
globalThis.useAppearanceStore = useAppearanceStore;
globalThis.useFeedStore = useFeedStore;
globalThis.useInputValidation = useInputValidation;

// Default stub for useUserSettings — returns defaults, no-ops on save.
// Individual tests can override this with vi.stubGlobal if needed.
globalThis.useUserSettings = vi.fn(() => ({
  loading: { value: false },
  error: { value: null },
  load: vi.fn().mockResolvedValue({ ...USER_SETTINGS_DEFAULTS }),
  save: vi.fn().mockResolvedValue({ ...USER_SETTINGS_DEFAULTS }),
}));

// Nuxt $fetch stub — returns null by default; individual tests override as needed.
globalThis.$fetch = vi.fn().mockResolvedValue(null);

// Nuxt router / navigation globals
globalThis.navigateTo = vi.fn();
globalThis.useRoute = vi.fn(() => ({ path: "/", params: {}, query: {} }));
globalThis.useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));
globalThis.definePageMeta = vi.fn();
globalThis.useHead = vi.fn();
globalThis.useSeoMeta = vi.fn();

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
globalThis.getQuery = (event: any) => event.query ?? {};

// Vue composition API — mirrors Nuxt's auto-import so components can use
// ref/computed/watch/etc. without explicit imports.
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
globalThis.ref = ref;
globalThis.computed = computed;
globalThis.watch = watch;
globalThis.onMounted = onMounted;
globalThis.onUnmounted = onUnmounted;

// Nuxt's $fetch global — tests override per-suite as needed.
globalThis.$fetch = vi.fn().mockResolvedValue([]);

// Feed and connections composable stubs — individual tests override as needed.
globalThis.useFeeds = vi.fn(() => ({
  items: ref([]),
  newUrl: ref(""),
  loading: ref(false),
  isAdding: ref(false),
  discovering: ref(false),
  error: ref(null),
  load: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
}));

globalThis.useConnections = vi.fn(() => ({
  items: ref([]),
  loading: ref(false),
  error: ref(null),
  load: vi.fn(),
  connect: vi.fn(),
  connectBluesky: vi.fn(),
  disconnect: vi.fn(),
}));

// Clerk composable stubs
const mockClerkUser = ref({
  firstName: "Demo",
  lastName: "User",
  fullName: "Demo User",
  primaryEmailAddress: { emailAddress: "demo@example.com" },
  imageUrl: "",
  hasImage: false,
  update: vi.fn().mockResolvedValue(undefined),
  setProfileImage: vi.fn().mockResolvedValue(undefined),
});
globalThis.useUser = () => ({ user: computed(() => mockClerkUser.value) });
globalThis.useClerk = () => ({ signOut: vi.fn() });
globalThis.useAuth = vi.fn(() => ({
  isSignedIn: ref(false),
  getToken: { value: vi.fn().mockResolvedValue(null) },
}));
globalThis.useUserProfile = () => ({
  firstName: ref("Demo"),
  lastName: ref("User"),
  saving: ref(false),
  error: ref(null),
  success: ref(false),
  saveProfile: vi.fn(),
  uploadAvatar: vi.fn(),
});

// Create a fresh Pinia instance before each test for store isolation.
// config.global.plugins ensures mounted components see the same instance.
beforeEach(() => {
  const pinia = createPinia();
  setActivePinia(pinia);
  config.global.plugins = [pinia];
});

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
  AvatarButton: true,
  UserProfile: true,
  InputText: true,
  InputTextarea: true,
  AppAlert: true,
  MarketingHeader: true,
  MarketingFooter: true,
  DashboardOnboarding: true,
  SettingsFeeds: true,
  SettingsConnections: true,
  SettingsReading: true,
  SettingsAccount: true,
  // Clerk components
  SignIn: true,
  SignUp: true,
};
