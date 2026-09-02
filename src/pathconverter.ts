/**
 * pathconverter.ts - SVG path "d" -> Penpot path.content (string passthrough).
 *
 * PHASE 1 SPIKE RESULT (verified live on Penpot 2.16.2, overrides the 2026-09-01
 * docs research): Penpot's `path.content` does NOT accept the documented
 * PathCommand[] array shape - it is silently ignored and a default line
 * ("M0.0,0.0L100.0,100.0") is stored instead (the #209 bug class). The SAME
 * content passed as an SVG path STRING is persisted exactly. Native arcs stay
 * intact in string form, so mermaid's stadium/rounded `a` commands pass
 * through unchanged - NO command-array mapping and NO arc-to-bezier needed.
 *
 * This module is a thin normalizer, not a full converter:
 *   - trim whitespace, reject empty/invalid d strings
 *   - return the string unchanged for assignment to path.content
 */

/** Validate a path string; throws on clearly-invalid input. */
export function normalizePathString(d: string): string {
  if (typeof d !== "string") {
    throw new TypeError("path d must be a string");
  }
  const trimmed = d.trim();
  if (!trimmed) {
    throw new Error("empty path d string");
  }
  // Must start with an SVG path command letter and contain numbers/commands.
  if (!/^[MmLlHhVvCcSsQqTtAaZz]/.test(trimmed)) {
    throw new Error("path d does not start with a valid SVG command");
  }
  // Reject strings with zero numeric content (e.g. "ZZ" - no geometry).
  if (!/\d/.test(trimmed)) {
    throw new Error("path d has no numeric content");
  }
  return trimmed;
}

/** Passthrough used by the importer: normalize then hand to Penpot verbatim. */
export function toPenpotContent(d: string): string {
  return normalizePathString(d);
}