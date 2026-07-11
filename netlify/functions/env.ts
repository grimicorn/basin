import dotenvx from "@dotenvx/dotenvx";

// Netlify Functions run at runtime as standalone Lambdas and do NOT receive the
// dotenvx-decrypted values that `nuxt build` bakes into the app bundle. Decrypt
// the same encrypted env file here so functions inherit identical config to the
// production/preview build. Requires the matching DOTENV_PRIVATE_KEY_* to be
// present in the function runtime scope and the .env file to be bundled via
// `included_files` in netlify.toml.
const ENV_FILE_BY_CONTEXT: Record<string, string> = {
  production: ".env.production",
  "deploy-preview": ".env.dev",
  "branch-deploy": ".env.dev",
};

const DEFAULT_ENV_FILE = ".env.production";

let loaded = false;

export function loadEnv() {
  if (loaded) {
    return;
  }

  const context = process.env.CONTEXT ?? "production";
  const path = ENV_FILE_BY_CONTEXT[context] ?? DEFAULT_ENV_FILE;
  dotenvx.config({ path, quiet: true });
  loaded = true;
}
