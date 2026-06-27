// Documented allowlist of dependency advisories the `dependency-audit` CI gate
// tolerates. The gate fails on any high/critical advisory NOT listed here, so a
// newly introduced vulnerability still breaks the build.
//
// Every entry is a pre-existing, deep-transitive advisory with NO non-breaking
// fix: `npm audit fix` cannot resolve it, and the only `npm audit fix --force`
// path installs `@netlify/async-workloads@0.0.92`, a documented BREAKING change.
// All entries trace to the Stackbit visual-editor toolchain (`@stackbit/*` →
// `@netlify/content-engine`) or Google Cloud Storage's transitive `uuid`.
//
// `reviewBy` is a hard expiry: once that date passes the gate fails on the
// entry again, forcing a human to re-check whether an upstream fix has shipped
// (e.g. a Stackbit/Netlify release that drops the vulnerable transitive) rather
// than letting the suppression rot silently.

export const ALLOWLIST_REVIEW_BY = "2026-09-27";

// `packages` lists the exact npm package name(s) the advisory is filed against
// (matched against `via.name` from `npm audit`). The gate only suppresses an
// advisory when BOTH its ID and the affected package match an entry — so if a
// "dev-only" package later moves into the production path under a different
// name, the suppression no longer applies and the gate fails as intended.
/** @type {Array<{ id: string, packages: string[], reason: string }>} */
export const ALLOWED_ADVISORIES = [
  {
    id: "GHSA-jr5f-v2jv-69x6",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-pmwg-cvhr-8vh7",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-pf86-5x62-jrwf",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-6chq-wfr3-2hj9",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-43fc-jf86-j433",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-pjwm-pj3p-43mv",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-hfxv-24rg-xrqf",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-p92q-9vqr-4j8v",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-j5f8-grm9-p9fc",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-3g43-6gmg-66jw",
    packages: ["axios"],
    reason:
      "Transitive via @stackbit/* and @netlify/content-engine; only fix is the breaking @netlify/async-workloads major.",
  },
  {
    id: "GHSA-c7qv-q95q-8v27",
    packages: ["http-proxy-middleware"],
    reason:
      "Transitive via @stackbit/dev; only fix is the breaking @netlify/async-workloads major. Dev-server proxy, not in the deployed runtime.",
  },
  {
    id: "GHSA-p6mc-m468-83gw",
    packages: ["lodash.pick", "lodash.set"],
    reason:
      "Transitive via @netlify/content-engine; no non-breaking fix. Stackbit build-time tooling, not request-path code.",
  },
  {
    id: "GHSA-ph9p-34f9-6g65",
    packages: ["tmp"],
    reason:
      "Transitive via devcert/yurnalist under @netlify/content-engine; no non-breaking fix. Local dev tooling.",
  },
  {
    id: "GHSA-5j98-mcp5-4vw2",
    packages: ["glob"],
    reason:
      "Transitive via @stackbit/cms-sanity; advisory is the glob CLI (-c/--cmd), which this codebase never invokes. No non-breaking fix.",
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
