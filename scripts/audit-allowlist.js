// Documented allowlist of dependency advisories the `dependency-audit` CI gate
// tolerates. The gate fails on any high/critical advisory NOT listed here, so a
// newly introduced vulnerability still breaks the build.
//
// Every entry must have a documented "no non-breaking fix available"
// justification in its `reason`. Periodic re-evaluation is forced by the single
// shared `ALLOWLIST_REVIEW_BY` date below: once it passes, the gate fails until
// every entry is re-reviewed (for an upstream fix) and the date is bumped.
//
// Previously this list contained 14 entries for the Stackbit/content-engine
// transitive chain. Those were eliminated by pinning `@netlify/sdk` to ^5.0.4
// via the `overrides` block in package.json — sdk 5.x dropped the
// @stackbit/* / @netlify/content-engine dependencies entirely.
//
// The current entries cover the unpatched `image-size` DoS advisories (no
// published fix — latest 2.0.2, advisory range <=2.0.2) that reach the tree only
// through @netlify/dev-utils, plus the chained @netlify/async-workloads advisory
// that is a pure consequence of the same image-size root cause.

export const ALLOWLIST_REVIEW_BY = "2026-09-27";

// `packages` lists the exact npm package name(s) the advisory is filed against
// (matched against `via.name` from `npm audit`). The gate only suppresses an
// advisory when BOTH its ID and the affected package match an entry — so if a
// "dev-only" package later moves into the production path under a different
// name, the suppression no longer applies and the gate fails as intended.
/** @type {Array<{ id: string, packages: string[], reason: string }>} */
export const ALLOWED_ADVISORIES = [
  {
    id: "GHSA-w3rx-r6r6-pgpr",
    packages: ["image-size"],
    reason:
      "image-size ICNS-parser DoS (infinite loop). No patched release exists: " +
      "latest published image-size is 2.0.2 and the advisory range is <=2.0.2, " +
      "so no override can resolve it. Reached only transitively via " +
      "@netlify/async-workloads > @netlify/sdk > ... > @netlify/dev-utils > image-size — " +
      "netlify build/dev tooling, not basin's request path; basin never parses " +
      "untrusted images through image-size. npm's only 'fix' is a semver-major " +
      "downgrade of the direct @netlify/async-workloads dependency. Re-check for an " +
      "image-size patch or an @netlify/sdk chain that drops it by reviewBy.",
  },
  {
    id: "GHSA-5p2g-fcmc-qvqq",
    packages: ["image-size"],
    reason:
      "image-size JXL/HEIF-parser DoS (infinite loop). Same root cause and reachability " +
      "as GHSA-w3rx-r6r6-pgpr: no patched image-size release (latest 2.0.2, advisory " +
      "range <=2.0.2), pulled only through @netlify/dev-utils, not basin's runtime path.",
  },
  {
    id: "source-WQd50vOH5wPTzKenE46N2oa/B6QboJET5IMAHAcuCaUn1/WqjtDxaFSZ/ICntZ3c1NLIv9v0lImDYe5nP8Z44g==",
    packages: ["@netlify/async-workloads"],
    reason:
      "Chained 'depends on vulnerable versions of @netlify/sdk' advisory that exists " +
      "solely because @netlify/sdk transitively pulls the unpatched image-size above. " +
      "Not a distinct vulnerability — it clears automatically once image-size ships a fix. " +
      "The only npm-proposed remediation is a semver-major downgrade of the direct dep.",
  },
];

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
