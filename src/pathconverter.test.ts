import { describe, expect, it } from "vitest";
import { normalizePathString, toPenpotContent } from "./pathconverter";

// Phase 1 spike ground truth: the exact strings that persisted correctly
// on Penpot 2.16.2 in TestB/TestC.
describe("pathconverter string passthrough (Phase 1 verified behavior)", () => {
  it("passes a simple rect d string through unchanged", () => {
    const d = "M 0 0 L 100 0 L 100 20 L 0 20 Z";
    expect(toPenpotContent(d)).toBe(d);
  });

  it("keeps relative vs absolute strings verbatim", () => {
    const rel = "m 0 0 l 10 5";
    expect(toPenpotContent(rel)).toBe(rel);
    const abs = "M 0 0 L 10 5";
    expect(toPenpotContent(abs)).toBe(abs);
  });

  it("keeps H/V commands untouched", () => {
    const d = "M 0 0 H 50 V 30 H 0 Z";
    expect(toPenpotContent(d)).toBe(d);
  });

  it("keeps S/T/Q/C curves untouched", () => {
    const d = "M 0 0 C 10 10 20 10 30 0 S 40 -10 50 0 Q 60 10 70 0 T 90 0";
    expect(toPenpotContent(d)).toBe(d);
  });

  it("passes a native arc (mermaid stadium shape) through unchanged", () => {
    // Real mermaid stadium/rounded node shape emits a/A arcs.
    const d = "M 10 0 A 10 10 0 0 1 10 20 A 10 10 0 0 1 10 0 Z";
    expect(toPenpotContent(d)).toBe(d);
  });

  it("trims surrounding whitespace only", () => {
    expect(toPenpotContent("  M 0 0 L 1 1  ")).toBe("M 0 0 L 1 1");
  });

  it("throws on empty string", () => {
    expect(() => normalizePathString("")).toThrow();
    expect(() => normalizePathString("   ")).toThrow();
  });

  it("throws on non-string input", () => {
    expect(() => normalizePathString(42 as unknown as string)).toThrow(TypeError);
  });

  it("throws on a d that is not a path (no numeric geometry)", () => {
    expect(() => normalizePathString("ZZ")).toThrow();
  });
});