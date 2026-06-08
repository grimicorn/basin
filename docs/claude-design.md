## From Claude Design

### Theming & design tokens

All colors, spacing, radius, and shadows are CSS custom properties declared in `assets/css/main.css`:

- **Light/dark** is driven by `prefers-color-scheme` and overridable via a `data-theme="light|dark"` attribute on `<html>` (set by `useAppearance`).
- **Accent / reading font / density** are `data-*` attributes + `--accent*` vars, also managed by `useAppearance` and surfaced in **Settings → Reading**.
- `tailwind.config.js` maps those tokens to utilities, so `class="bg-surface text-ink border-border"` automatically respects theme + accent. Use utilities for layout/one-offs; the reusable pieces are Vue components with a few shared CSS classes (`.card`, `.btn`, `.seg`) — Tailwind's recommended split.

To change defaults (e.g. ship "cozy" spacing or a different accent), edit `DEFAULTS` in `composables/useAppearance.js`.

---

### Wiring real data

Everything reads from `data/mock.js` through `composables/useFeed.js`. To go live:

1. Replace the `items` / `feeds` / `connections` exports in `data/mock.js` with your API response shape (keep the field names, or update the components).
2. In `useFeed.js`, swap the synchronous seed for fetches — e.g. `useAsyncData`/`$fetch` in `setupWatchers`, and turn `addFeed` / `toggleConn` / `toggleSave` into real mutations.
3. The "open original", play, and OAuth buttons currently fire a toast — point them at real URLs / SDKs.

Item shape (per source `type`): `article`, `podcast`, `video`, `tweet`, `photo` — see `data/mock.js` for fields each card uses.

---

### Notes

- **SSR**: theme is applied on the client (reads `localStorage`), so there may be a brief flash to the saved theme on first paint. If you want it flash-free, move the `data-theme` write into an inline head script or a Nuxt plugin that reads a cookie.
- **Fonts**: JetBrains Mono + Newsreader load from Google Fonts via `nuxt.config.ts`. Self-host with `@nuxt/fonts` if you prefer.
- This is a front-end prototype: no backend, no auth, mock content.
