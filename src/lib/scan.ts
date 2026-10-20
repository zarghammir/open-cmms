import type { Asset, Part } from "@/domain/types";

/**
 * What a label holds, and what a scan means.
 *
 * Pure on purpose: no store, no repository, no browser. The camera, the file
 * upload and a handheld barcode reader that types into a field all arrive here
 * as a string, so there is one description of what a scan means rather than
 * three that drift apart.
 */

export const SCAN_KINDS = ["asset", "part"] as const;
export type ScanKind = (typeof SCAN_KINDS)[number];

/** The module each kind lives under, locale-free. */
const ROUTE_FOR_KIND: Record<ScanKind, string> = {
  asset: "/assets",
  part: "/inventory",
};

const KIND_FOR_SEGMENT: Record<string, ScanKind> = {
  assets: "asset",
  inventory: "part",
};

/**
 * A label addresses a record by the identifier people say out loud — the asset
 * tag `AHU-KGN-01`, the stock number `FLT-2101` — never by `Id`, which
 * `domain/types/common.ts` calls opaque and which the seed rebuilds whenever
 * the demonstration is reset. A label printed on Tuesday has to still open its
 * asset on Thursday, and only the tag survives that.
 */
export function labelPath(kind: ScanKind, identifier: string): string {
  return `${ROUTE_FOR_KIND[kind]}/${encodeURIComponent(identifier)}/label`;
}

/**
 * What the QR encodes: an absolute address on whatever origin the application
 * is being served from, read at render time and never hardcoded, so a label
 * printed from a preview deployment points at that preview and a label printed
 * from production points at production.
 *
 * It has to be absolute because the phone camera app that reads it is not our
 * application — it can only act on a whole URL.
 */
export function labelUrl(
  origin: string,
  locale: string,
  kind: ScanKind,
  identifier: string,
): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/${locale}${labelPath(kind, identifier)}`;
}

export type ScanTarget =
  | { source: "url"; kind: ScanKind; identifier: string }
  | { source: "text"; identifier: string };

/**
 * Reads scanned text into what it points at.
 *
 * Two shapes arrive. One of our QR codes carries a full URL; a handheld reader
 * pointed at the Code 128 stripe types the bare identifier. Both are accepted.
 *
 * Only the **path** is read. The host is ignored deliberately: a scan never
 * navigates to the address it was given, it looks the identifier up in our own
 * records, so a QR someone else printed cannot send a technician anywhere.
 *
 * Returns `null` when the text means nothing to us — which the caller must
 * carry through as "unknown" rather than turning into a guess.
 */
export function parseScan(text: string): ScanTarget | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }

  const pathname = pathnameOf(trimmed);
  if (pathname === null) {
    return identifierTarget(trimmed);
  }

  const segments = pathname.split("/").filter((segment) => segment !== "");
  // Find the module segment wherever it sits, so a locale prefix, a base path
  // or a trailing `/label` all parse the same way.
  const moduleIndex = segments.findIndex(
    (segment) => segment.toLowerCase() in KIND_FOR_SEGMENT,
  );
  if (moduleIndex === -1) {
    return null;
  }

  const kind = KIND_FOR_SEGMENT[segments[moduleIndex]!.toLowerCase()]!;
  const raw = segments[moduleIndex + 1];
  if (raw === undefined) {
    return null;
  }

  const identifier = normalize(raw);
  return identifier === null ? null : { source: "url", kind, identifier };
}

/** The path of an absolute or root-relative address, or null for plain text. */
function pathnameOf(text: string): string | null {
  if (text.startsWith("/")) {
    return text;
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    return null;
  }
  try {
    return new URL(text).pathname;
  } catch {
    return null;
  }
}

function identifierTarget(text: string): ScanTarget | null {
  const identifier = normalize(text);
  return identifier === null ? null : { source: "text", identifier };
}

/**
 * Identifiers are upper case throughout the records and the import fixture, so
 * a reader that reports lower case still finds its record. Percent-encoding is
 * undone, and malformed encoding means the text was not one of our labels.
 */
function normalize(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const identifier = decoded.trim().toUpperCase();
  return identifier === "" ? null : identifier;
}

export interface ScanLookups {
  assetByTag: (tag: string) => Asset | undefined;
  partByNumber: (partNumber: string) => Part | undefined;
}

export type ScanResult =
  | { outcome: "asset"; asset: Asset }
  | { outcome: "part"; part: Part }
  | { outcome: "unknown"; scanned: string };

/**
 * Turns scanned text into a record, or into `unknown`.
 *
 * Three answers, never two. A code we cannot place is `unknown` — it is not
 * the nearest record and it is not an empty result. Standing in a corridor
 * holding the wrong asset's history is worse than being told the label was not
 * recognised.
 *
 * A URL that names the assets module is looked up **only** among assets. If it
 * carries a stock number the answer is `unknown`, not the part: the label said
 * what it was, and disagreeing with it is guessing.
 */
export function resolveScan(text: string, lookups: ScanLookups): ScanResult {
  const scanned = text.trim();
  const target = parseScan(text);
  if (target === null) {
    return { outcome: "unknown", scanned };
  }

  if (target.source === "url") {
    if (target.kind === "asset") {
      const asset = lookups.assetByTag(target.identifier);
      return asset
        ? { outcome: "asset", asset }
        : { outcome: "unknown", scanned };
    }
    const part = lookups.partByNumber(target.identifier);
    return part ? { outcome: "part", part } : { outcome: "unknown", scanned };
  }

  const asset = lookups.assetByTag(target.identifier);
  if (asset) {
    return { outcome: "asset", asset };
  }
  const part = lookups.partByNumber(target.identifier);
  if (part) {
    return { outcome: "part", part };
  }
  return { outcome: "unknown", scanned };
}
