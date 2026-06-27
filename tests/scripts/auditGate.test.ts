import { describe, it, expect } from "vitest";
import {
  advisoryIdFromUrl,
  collectBlockingAdvisories,
  partitionByAllowlist,
} from "../../scripts/audit-gate.js";
import { ALLOWED_ADVISORY_IDS } from "../../scripts/audit-allowlist.js";

const ALLOWED_ID = [...ALLOWED_ADVISORY_IDS][0];

function advisoryVia(id: string, severity: string) {
  return {
    name: "some-package",
    url: `https://github.com/advisories/${id}`,
    severity,
    title: `${severity} advisory ${id}`,
  };
}

describe("advisoryIdFromUrl", () => {
  it("extracts the GHSA id from an advisory url", () => {
    expect(
      advisoryIdFromUrl("https://github.com/advisories/GHSA-abcd-1234"),
    ).toBe("GHSA-abcd-1234");
  });

  it("returns null for non-string input", () => {
    expect(advisoryIdFromUrl(undefined)).toBeNull();
  });
});

describe("collectBlockingAdvisories", () => {
  it("keeps only high and critical advisories", () => {
    const report = {
      vulnerabilities: {
        pkgA: { via: [advisoryVia("GHSA-high-1", "high")] },
        pkgB: { via: [advisoryVia("GHSA-mod-1", "moderate")] },
        pkgC: { via: [advisoryVia("GHSA-crit-1", "critical")] },
        pkgD: { via: [advisoryVia("GHSA-low-1", "low")] },
      },
    };
    const ids = collectBlockingAdvisories(report).map(
      (advisory) => advisory.id,
    );
    expect(ids.sort()).toEqual(["GHSA-crit-1", "GHSA-high-1"]);
  });

  it("ignores string via entries (names of other vulnerable deps)", () => {
    const report = {
      vulnerabilities: {
        pkgA: {
          via: ["another-vulnerable-dep", advisoryVia("GHSA-high-1", "high")],
        },
      },
    };
    const ids = collectBlockingAdvisories(report).map(
      (advisory) => advisory.id,
    );
    expect(ids).toEqual(["GHSA-high-1"]);
  });

  it("deduplicates advisories that surface under multiple packages", () => {
    const shared = advisoryVia("GHSA-shared", "high");
    const report = {
      vulnerabilities: {
        pkgA: { via: [shared] },
        pkgB: { via: [shared] },
      },
    };
    expect(collectBlockingAdvisories(report)).toHaveLength(1);
  });

  it("returns an empty array when there are no vulnerabilities", () => {
    expect(collectBlockingAdvisories({})).toEqual([]);
  });
});

describe("partitionByAllowlist", () => {
  it("suppresses allowlisted ids and blocks the rest", () => {
    const advisories = [
      { id: ALLOWED_ID, severity: "high", package: "axios", title: "t" },
      {
        id: "GHSA-not-allowed",
        severity: "critical",
        package: "evil",
        title: "t",
      },
    ];
    const { suppressed, blocking } = partitionByAllowlist(advisories);
    expect(suppressed.map((advisory) => advisory.id)).toEqual([ALLOWED_ID]);
    expect(blocking.map((advisory) => advisory.id)).toEqual([
      "GHSA-not-allowed",
    ]);
  });

  it("blocks everything when nothing is allowlisted", () => {
    const advisories = [
      { id: "GHSA-x", severity: "high", package: "a", title: "t" },
      { id: "GHSA-y", severity: "critical", package: "b", title: "t" },
    ];
    const { suppressed, blocking } = partitionByAllowlist(advisories);
    expect(suppressed).toEqual([]);
    expect(blocking).toHaveLength(2);
  });
});
