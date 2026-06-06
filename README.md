# Reeder

A personal content feed aggregator built with Nuxt 4, Vue.js, and Tailwind CSS. Deployed on Netlify.

## Requirements

- Node.js >= 24 (see [.nvmrc](.nvmrc))
- npm

## Setup

Install dependencies:

```bash
npm install
```

## Development

Start the dev server at `http://localhost:3000`:

```bash
npm run dev
```

## Testing

Run tests in watch mode:

```bash
npm test
```

Run tests once (CI mode):

```bash
npm run test:ci
```

Open the Vitest UI:

```bash
npm run test:ui
```

## Linting

Check for lint and formatting issues:

```bash
npm run lint
```

Auto-fix issues:

```bash
npm run lint:fix
```

## Build & Preview

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deployment

The app deploys to Netlify automatically on push to `main` or `dev`. The build command runs tests before building:

```bash
npm run test:ci && npm run build
```

## Git Hooks

A pre-push hook runs via Husky. To skip hooks in CI, set `HUSKY=0`.
