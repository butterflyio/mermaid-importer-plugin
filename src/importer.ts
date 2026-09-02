/**
 * importer.ts - SVG DOM -> Penpot shapes.
 *
 * Phase 5: for each mermaid node, create the matching Penpot object.
 * Uses the Phase 1 verified patterns:
 *  - path shape -> penpot.createPath() with content = SVG d STRING (the
 *    verified workaround; PathCommand arrays silently fail on 2.16.2)
 *  - rect/ellipse -> createRectangle / createEllipse
 *  - foreignObject label -> createText with inline style mapping
 *  - position via mermaid's transform="translate(tx ty)"
 */

import { toPenpotContent } from "./pathconverter";

export interface SvgNodeData {
  id: string;
  transform: string; // "translate(tx ty)"
  label: string;
  labelStyle: Record<string, string>;
  labelW: number;
  labelH: number;
  shape: { kind: "path" | "rect" | "ellipse"; d?: string; x?: number; y?: number; w?: number; h?: number; rx?: number; ry?: number };
}

export function parseTransform(transform: string): { x: number; y: number } {
  const m = /translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/.exec(transform);
  if (!m) return { x: 0, y: 0 };
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

/** Parse an inline style string "a:b;c:d" into a record. */
export function parseInlineStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of style.split(";")) {
    const idx = part.indexOf(":");
    if (idx > 0) {
      out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

/** Extract per-node data from the rendered SVG DOM. */
export function extractNodes(svgDoc: Document): SvgNodeData[] {
  const nodes = svgDoc.querySelectorAll("g.nodes > g.node");
  const out: SvgNodeData[] = [];
  nodes.forEach((node) => {
    const id = node.getAttribute("id") || "";
    const transform = node.getAttribute("transform") || "";
    // Label from the foreignObject
    const fo = node.querySelector("foreignObject");
    let label = "";
    let labelStyle: Record<string, string> = {};
    // mermaid renders the label box with EXACT width/height attributes - these
    // give us the true text box size for centering in Penpot.
    let labelW = 0;
    let labelH = 0;
    if (fo) {
      label = fo.textContent?.trim() ?? "";
      const styleAttr = fo.getAttribute("style") || "";
      labelStyle = parseInlineStyle(styleAttr);
      labelW = parseFloat(fo.getAttribute("width") || "0") || 0;
      labelH = parseFloat(fo.getAttribute("height") || "0") || 0;
    }
    // Shape: path (d) or rect/ellipse (geometry)
    let shape: SvgNodeData["shape"] = { kind: "path" };
    const pathEl = node.querySelector("path");
    const rectEl = node.querySelector("rect");
    const ellipseEl = node.querySelector("ellipse");
    if (pathEl && pathEl.getAttribute("d")) {
      shape = { kind: "path", d: pathEl.getAttribute("d")! };
    } else if (rectEl) {
      shape = {
        kind: "rect",
        x: parseFloat(rectEl.getAttribute("x") || "0"),
        y: parseFloat(rectEl.getAttribute("y") || "0"),
        w: parseFloat(rectEl.getAttribute("width") || "0"),
        h: parseFloat(rectEl.getAttribute("height") || "0"),
        rx: rectEl.getAttribute("rx") ? parseFloat(rectEl.getAttribute("rx")!) : undefined,
        ry: rectEl.getAttribute("ry") ? parseFloat(rectEl.getAttribute("ry")!) : undefined,
      };
    } else if (ellipseEl) {
      shape = { kind: "ellipse" };
    }
    out.push({ id, transform, label, labelStyle, labelW, labelH, shape });
  });
  return out;
}

/**
 * Create a Penpot object for one SVG node. Returns the created shape(s).
 * The caller collects them for board assembly (Phase 7).
 */
export function importNode(nodeData: SvgNodeData): any[] {
  const created: any[] = [];
  const pos = parseTransform(nodeData.transform);
  const name = nodeData.label || nodeData.id || "mermaid-node";

  if (nodeData.shape.kind === "path" && nodeData.shape.d) {
    const p = penpot.createPath();
    p.name = name;
    p.content = toPenpotContent(nodeData.shape.d);
    p.x = pos.x;
    p.y = pos.y;
    p.fills = [{ fillColor: "#d0d0d0", fillOpacity: 0 }];
    p.strokes = [{ strokeColor: "#2e3434", strokeWidth: 2 }];
    created.push(p);
  } else if (nodeData.shape.kind === "rect" && nodeData.shape.w && nodeData.shape.h) {
    const r = penpot.createRectangle();
    r.name = name;
    const rx = nodeData.shape.rx ?? 0;
    r.x = pos.x + (nodeData.shape.x ?? 0);
    r.y = pos.y + (nodeData.shape.y ?? 0);
    r.resize(nodeData.shape.w!, nodeData.shape.h!);
    r.fills = [{ fillColor: "#d0d0d0" }];
    r.strokes = [{ strokeColor: "#2e3434", strokeWidth: 2 }];
    // Penpot rectangle border radius (single value applies to all corners)
    if (rx > 0) {
      (r as any).borderRadius = rx;
    }
    created.push(r);
  } else if (nodeData.shape.kind === "ellipse") {
    const e = penpot.createEllipse();
    e.name = name;
    // Mermaid ellipse nodes get a path shape usually; fallback sizing
    e.x = pos.x;
    e.y = pos.y;
    e.resize(120, 60);
    e.fills = [{ fillColor: "#d0d0d0" }];
    e.strokes = [{ strokeColor: "#2e3434", strokeWidth: 2 }];
    created.push(e);
  }

  // Text label
  if (nodeData.label) {
    const t = penpot.createText(nodeData.label);
    if (!t) return created;
    t.name = name + "-text";
    t.x = pos.x;
    t.y = pos.y;
    t.growType = "auto-width";
    const fontSize = parseFloat(nodeData.labelStyle["font-size"] || "16");
    t.fontSize = String(fontSize);
    const colorMatch = /rgb\((\d+),?\s*(\d+),?\s*(\d+)/.exec(nodeData.labelStyle["color"] || "");
    if (colorMatch) {
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      t.fills = [{ fillColor: `#${toHex(+colorMatch[1])}${toHex(+colorMatch[2])}${toHex(+colorMatch[3])}`, fillOpacity: 1 }];
    }
    created.push(t);
  }

  return created;
}

/**
 * Compute the endpoint + incoming direction of a path d string.
 * Tokenizes numeric coordinates; the final point is the endpoint, the
 * second-to-last is used for the arrowhead direction vector.
 */
export function edgeEndpoint(d: string): { x: number; y: number; dx: number; dy: number } {
  const nums = d.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
  // SVG path: coordinates come in pairs. Last pair = endpoint.
  const n = nums.length;
  if (n < 4) {
    return { x: 0, y: 0, dx: 1, dy: 0 };
  }
  const ex = nums[n - 2];
  const ey = nums[n - 1];
  const px = nums[n - 4];
  const py = nums[n - 3];
  let dx = ex - px;
  let dy = ey - py;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    dx = 1;
    dy = 0;
  } else {
    dx /= len;
    dy /= len;
  }
  return { x: ex, y: ey, dx, dy };
}

export interface SvgEdgeData {
  id: string;
  d: string;
  strokeColor: string;
  strokeWidth: number;
  // arrowhead geometry (computed endpoint + direction from the path)
  arrowX: number;
  arrowY: number;
  arrowDX: number;
  arrowDY: number;
  // optional edge label text + position (from g.edgeLabels)
  label?: string;
  labelX?: number;
  labelY?: number;
  labelW?: number;
  labelH?: number;
}

/** Extract edge data from the rendered SVG DOM. */
export function extractEdges(svgDoc: Document): SvgEdgeData[] {
  const edges: SvgEdgeData[] = [];
  // Edge paths
  const paths = svgDoc.querySelectorAll("g.edgePaths > path");
  paths.forEach((p, idx) => {
    const d = p.getAttribute("d") || "";
    if (!d) return;
    // Stroke color/width from CSS style or attrs (mermaid uses style="...")
    const styleAttr = p.getAttribute("style") || "";
    const st = parseInlineStyle(styleAttr);
    let strokeColor = "#333333";
    const strokeMatch = /stroke:\s*([^;]+)/.exec(styleAttr);
    if (strokeMatch) strokeColor = strokeMatch[1].trim();
    let strokeWidth = 2;
    const wMatch = /stroke-width:\s*([\d.]+)/.exec(styleAttr);
    if (wMatch) strokeWidth = parseFloat(wMatch[1]);
    const ep = edgeEndpoint(d);
    edges.push({
      id: p.getAttribute("id") || `edge-${idx}`,
      d,
      strokeColor,
      strokeWidth,
      arrowX: ep.x,
      arrowY: ep.y,
      arrowDX: ep.dx,
      arrowDY: ep.dy,
    });
  });
  // Edge labels (branch text). Structure (verified live): the label sits in
  // <g class="label" data-id="L_A_B_0" transform="translate(tx ty)"> wrapping
  // the foreignObject - position comes from the PARENT g's transform, and the
  // data-id matches the edge id that owns it.
  const labels = svgDoc.querySelectorAll("g.edgeLabels g.label, g.edgeLabels > foreignObject");
  labels.forEach((el) => {
    const fo = el.tagName === "foreignObject" ? el : el.querySelector("foreignObject");
    if (!fo) {
      return;
    }
    const text = fo.textContent?.trim();
    if (!text) {
      return;
    }
    const parent = el.tagName === "foreignObject" ? el.parentElement : el;
    // The label's parent chain: g.label (own centering offset) sits inside
    // g.edgeLabel (transform = the edge MIDPOINT / true position). Use the
    // g.edgeLabel ancestor's transform, not the -w/2,-h/2 inner offset.
    const anchorG = parent?.classList?.contains("edgeLabel")
      ? parent
      : (parent?.parentElement?.classList?.contains("edgeLabel")
        ? parent.parentElement
        : parent);
    const transform = anchorG?.getAttribute("transform") || "";
    const tm = /translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/.exec(transform);
    const tx = tm ? parseFloat(tm[1]) : 0;
    const ty = tm ? parseFloat(tm[2]) : 0;
    const dataId = parent?.getAttribute("data-id") || "";
    let bestEdge: SvgEdgeData | undefined;
    if (dataId) {
      // Match by edge id suffix (mermaid ids: L_A_B_0; edge path id: graphDiv-L_A_B_0)
      bestEdge = edges.find((e) => e.id.includes(dataId));
    }
    if (!bestEdge) {
      // Fallback: nearest arrow endpoint
      let bestDist = Infinity;
      for (const e of edges) {
        const d = Math.hypot(e.arrowX - tx, e.arrowY - ty);
        if (d < bestDist) {
          bestDist = d;
          bestEdge = e;
        }
      }
    }
    if (bestEdge) {
      bestEdge.label = text;
      bestEdge.labelX = tx;
      bestEdge.labelY = ty;
      bestEdge.labelW = parseFloat(fo.getAttribute("width") || "0") || 0;
      bestEdge.labelH = parseFloat(fo.getAttribute("height") || "0") || 0;
    }
  });
  return edges;
}