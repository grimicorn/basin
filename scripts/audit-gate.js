// Dependency-audit gate. Reads `npm audit --json` from stdin, keeps only
// high/critical advisories, drops the ones in the documented allowlist
// (scripts/audit-allowlist.js), and exits non-zero if any high/critical
// advisory remains. A NEW high/critical advisory that is not allowlisted still
// fails the build, so the gate stays meaningful.
//
// Usage (see .github/workflows/ci.yml):
//   npm audit --json | node scripts/audit-gate.js

import { pathToFileURL } from "node:url";
import {
  ALLOWED_ADVISORY_IDS,
  ALLOWED_ADVISORIES,
  ALLOWLIST_REVIEW_BY,
} from "./audit-allowlist.js";

const BLOCKING_SEVERITIES = new Set(["high", "critical"]);
const EXIT_FAILURE = 1;

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf8")),
    );
    process.stdin.on("error", reject);
  });
}

function parseAuditReport(rawJson) {
  if (!rawJson.trim()) {
    throw new Error("No npm audit JSON received on stdin.");
  }
  return JSON.parse(rawJson);
}

export function advisoryIdFromUrl(url) {
  if (typeof url !== "string") {
    return null;
  }
  const segments = url.split("/");
  return segments[segments.length - 1] || null;
}

// `via` entries are either a string (name of another vulnerable dep) or an
// object describing the advisory. We only care about the advisory objects.
function blockingAdvisoriesFromVia(viaList) {
  const advisories = [];
  for (const via of viaList || []) {
    if (typeof via !== "object" || via === null) {
      continue;
    }
    if (!BLOCKING_SEVERITIES.has(via.severity)) {
      continue;
    }
    const id = advisoryIdFromUrl(via.url);
    if (!id) {
      continue;
    }
    advisories.push({
      id,
      severity: via.severity,
      package: via.name,
      title: via.title,
    });
  }
  return advisories;
}

export function collectBlockingAdvisories(auditReport) {
  const vulnerabilities = auditReport.vulnerabilities || {};
  const byId = new Map();
  for (const vulnerability of Object.values(vulnerabilities)) {
    for (const advisory of blockingAdvisoriesFromVia(vulnerability.via)) {
      if (byId.has(advisory.id)) {
        continue;
      }
      byId.set(advisory.id, advisory);
    }
  }
  return [...byId.values()];
}

function isAllowlistExpired() {
  return new Date() >= new Date(`${ALLOWLIST_REVIEW_BY}T00:00:00Z`);
}

function reportAllowlistExpired() {
  console.error(
    `Audit allowlist expired on ${ALLOWLIST_REVIEW_BY}. Re-review every entry in ` +
      `scripts/audit-allowlist.js (check for upstream fixes) and bump ALLOWLIST_REVIEW_BY.`,
  );
}

function reportSuppressed(suppressedAdvisories) {
  if (!suppressedAdvisories.length) {
    return;
  }
  console.log(
    `Allowlisted (suppressed) high/critical advisories: ${suppressedAdvisories.length}`,
  );
  for (const advisory of suppressedAdvisories) {
    console.log(
      `  - ${advisory.id} [${advisory.severity}] ${advisory.package}`,
    );
  }
}

function reportBlocking(blockingAdvisories) {
  console.error(
    `Found ${blockingAdvisories.length} high/critical advisory(ies) not in the allowlist:`,
  );
  for (const advisory of blockingAdvisories) {
    console.error(
      `  - ${advisory.id} [${advisory.severity}] ${advisory.package}: ${advisory.title}`,
    );
  }
  console.error(
    "Fix the dependency, or — only if there is no non-breaking fix — add a justified, " +
      "dated entry to scripts/audit-allowlist.js.",
  );
}

export function partitionByAllowlist(advisories) {
  const suppressed = [];
  const blocking = [];
  for (const advisory of advisories) {
    const bucket = ALLOWED_ADVISORY_IDS.has(advisory.id)
      ? suppressed
      : blocking;
    bucket.push(advisory);
  }
  return { suppressed, blocking };
}

function warnOnStaleAllowlistEntries(suppressedAdvisories) {
  const triggeredIds = new Set(
    suppressedAdvisories.map((advisory) => advisory.id),
  );
  const staleEntries = ALLOWED_ADVISORIES.filter(
    (entry) => !triggeredIds.has(entry.id),
  );
  if (!staleEntries.length) {
    return;
  }
  console.log(
    `Note: ${staleEntries.length} allowlist entry(ies) no longer match any advisory ` +
      "and can be removed from scripts/audit-allowlist.js:",
  );
  for (const entry of staleEntries) {
    console.log(`  - ${entry.id} (${entry.package})`);
  }
}

async function main() {
  if (isAllowlistExpired()) {
    reportAllowlistExpired();
    process.exit(EXIT_FAILURE);
  }

  const auditReport = parseAuditReport(await readStdin());
  const advisories = collectBlockingAdvisories(auditReport);
  const { suppressed, blocking } = partitionByAllowlist(advisories);

  reportSuppressed(suppressed);
  warnOnStaleAllowlistEntries(suppressed);

  if (blocking.length) {
    reportBlocking(blocking);
    process.exit(EXIT_FAILURE);
  }

  console.log(
    "Dependency audit passed: no un-allowlisted high/critical advisories.",
  );
}

function isDirectInvocation() {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }
  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectInvocation()) {
  main().catch((error) => {
    console.error(`audit-gate failed: ${error.message}`);
    process.exit(EXIT_FAILURE);
  });
}
