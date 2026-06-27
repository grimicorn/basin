// Documented allowlist of dependency advisories the `dependency-audit` CI gate
// tolerates. The gate fails on any high/critical advisory NOT listed here, so a
// newly introduced vulnerability still breaks the build.
//
// Every entry must have a documented non-breaking fix unavailable justification
// and a `reviewBy` expiry date that forces periodic re-evaluation.
//
// Previously this list contained 14 entries for the Stackbit/content-engine
// transitive chain. Those were eliminated by pinning `@netlify/sdk` to ^5.0.4
// via the `overrides` block in package.json — sdk 5.x dropped the
// @stackbit/* / @netlify/content-engine dependencies entirely.

export const ALLOWLIST_REVIEW_BY = "2026-09-27";

// `packages` lists the exact npm package name(s) the advisory is filed against
// (matched against `via.name` from `npm audit`). The gate only suppresses an
// advisory when BOTH its ID and the affected package match an entry — so if a
// "dev-only" package later moves into the production path under a different
// name, the suppression no longer applies and the gate fails as intended.
/** @type {Array<{ id: string, packages: string[], reason: string }>} */
export const ALLOWED_ADVISORIES = [];

const ALLOWED_KEYS = new Set(
  ALLOWED_ADVISORIES.flatMap((advisory) =>
    advisory.packages.map((packageName) => `${advisory.id}::${packageName}`),
  ),
);

// An advisory is suppressed only when its ID AND affected package both match an
// allowlist entry, so a justification tied to where a package sits in the tree
// stops applying if a different package later trips the same advisory ID.
export function isAdvisoryAllowed(advisoryId, packageName) {
  return ALLOWED_KEYS.has(`${advisoryId}::${packageName}`);
}
