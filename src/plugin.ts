/**
 * Plugin entry. Runs inside Penpot's plugin runtime with the `penpot` global.
 *
 * PHASE 1 SPIKE FINDINGS baked in (verified live on design.promptraise.com 2.16.2):
 * - `penpot.ui.open` path resolves from ORIGIN ROOT - use absolute path.
 * - `penpot.ui.onMessage` receives an EVENT OBJECT ({ type }), not a raw string.
 * - The UI iframe does NOT get a `penpot` global - it must postMessage to parent.
 *
 * CRITICAL BUILD CONSTRAINT (discovered Phase 5): Penpot loads plugin code as a
 * CLASSIC SCRIPT. Vite emits ESM `import` statements when plugin.ts imports
 * other modules, which breaks the plugin silently. Therefore this file must be
 * SELF-CONTAINED (no imports) so it bundles to a single classic script.
 * The importer node-creation logic is inlined below (keep it dependency-free!).
 * The UI frame (index.html -> main.ts) handles mermaid rendering + extraction.
 */

function toPenpotContent(d: string): string {
  const trimmed = d.trim();
  if (!trimmed) throw new Error("empty path string");
  return trimmed;
}

function parseTransform(transform: string): { x: number; y: number } {
  const m = /translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/.exec(transform);
  if (!m) return { x: 0, y: 0 };
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function parseInlineStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of style.split(";")) {
    const idx = part.indexOf(":");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

interface SvgNodeData {
  id: string;
  transform: string;
  label: string;
  labelStyle: Record<string, string>;
  shape: {
    kind: "path" | "rect" | "ellipse";
    d?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    rx?: number;
  };
}

function importNode(nodeData: SvgNodeData): any[] {
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
    if (rx > 0) (r as any).borderRadius = rx;
    created.push(r);
  } else if (nodeData.shape.kind === "ellipse") {
    const e = penpot.createEllipse();
    e.name = name;
    e.x = pos.x;
    e.y = pos.y;
    e.resize(120, 60);
    e.fills = [{ fillColor: "#d0d0d0" }];
    e.strokes = [{ strokeColor: "#2e3434", strokeWidth: 2 }];
    created.push(e);
  }

  if (nodeData.label) {
    const t = penpot.createText(nodeData.label);
    if (t) {
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
  }

  return created;
}

interface SvgEdgeData {
  id: string;
  d: string;
  strokeColor: string;
  strokeWidth: number;
  arrowX: number;
  arrowY: number;
  arrowDX: number;
  arrowDY: number;
  label?: string;
  labelX?: number;
  labelY?: number;
}

/**
 * Create Penpot objects for one edge: a stroked path (the connector) plus a
 * filled triangle at the endpoint oriented along the edge direction (arrowhead).
 */
function importEdge(edge: SvgEdgeData): any[] {
  const created: any[] = [];

  // 1. The connector path - stroked, no fill.
  const path = penpot.createPath();
  path.name = edge.id || "mermaid-edge";
  path.content = toPenpotContent(edge.d);
  path.fills = [];
  path.strokes = [{ strokeColor: edge.strokeColor || "#333333", strokeWidth: edge.strokeWidth || 2 }];
  created.push(path);

  // 2. Arrowhead: a small filled triangle at the endpoint, oriented along the
  //    edge direction. Mermaid markers are triangle ~10px; we draw an
  //    isoceles triangle pointing along (dx, dy).
  const size = Math.max(8, (edge.strokeWidth || 2) * 4);
  const ax = edge.arrowX;
  const ay = edge.arrowY;
  const dx = edge.arrowDX;
  const dy = edge.arrowDY;
  // perpendicular
  const px = -dy;
  const py = dx;
  const tip = `${ax},${ay}`;
  const b1 = `${ax - dx * size + px * (size / 2)},${ay - dy * size + py * (size / 2)}`;
  const b2 = `${ax - dx * size - px * (size / 2)},${ay - dy * size - py * (size / 2)}`;
  const arrow = penpot.createPath();
  arrow.name = (edge.id || "arrow") + "-arrow";
  arrow.content = `M ${tip} L ${b1} L ${b2} Z`;
  arrow.fills = [{ fillColor: edge.strokeColor || "#333333" }];
  arrow.strokes = [];
  created.push(arrow);

  // 3. Edge label (branch text)
  if (edge.label) {
    const t = penpot.createText(edge.label);
    if (t) {
      t.name = (edge.id || "edge") + "-label";
      t.x = edge.labelX ?? edge.arrowX;
      t.y = edge.labelY ?? edge.arrowY;
      t.growType = "auto-width";
      t.fontSize = "13";
      created.push(t);
    }
  }

  return created;
}

/**
 * Phase 7: package all imported objects into one named board.
 * Measures bounds from created shape positions, creates a board sized to fit,
 * nests every shape inside it via parent assignment, selects the board.
 */
function assembleBoard(created: any[]): any | null {
  if (!created.length) return null;
  // Compute bounds from created shapes (x/y + approx size). Paths/lines may
  // have no reliable size, so fall back to a generous padded box.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  created.forEach((s: any) => {
    const x = s.x ?? 0;
    const y = s.y ?? 0;
    const w = s.width ?? s.resize?.last?.width ?? 0;
    const h = s.height ?? s.resize?.last?.height ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  if (!isFinite(minX) || !isFinite(minY)) {
    minX = 0; minY = 0; maxX = 400; maxY = 300;
  }
  const pad = 40;
  const bw = (maxX - minX) + pad * 2;
  const bh = (maxY - minY) + pad * 2;
  const bx = minX - pad;
  const by = minY - pad;

  const board = penpot.createBoard();
  if (!board) return null;
  board.name = `Mermaid Diagram - ${new Date().toISOString().slice(0, 10)}`;
  board.x = bx;
  board.y = by;
  board.resize(bw, bh);

  // Nest children into the board. Each shape's parent is the board.
  created.forEach((s: any) => {
    try {
      // Correct Penpot plugin API: board.appendChild(child)
      (board as any).appendChild?.(s);
    } catch {
      // some shapes may not support nesting - ignore
    }
  });

  return board;
}

penpot.ui.open("Mermaid Importer", "/mermaid-importer-plugin/index.html", {
  width: 480,
  height: 640,
});

penpot.ui.onMessage((msg: unknown) => {
  const payload = (msg as { type?: string }) ?? {};
  const type = payload.type ?? String(msg);
  if (type === "import-nodes") {
    const nodes = (payload as { nodes?: SvgNodeData[] }).nodes ?? [];
    const edges = (payload as { edges?: SvgEdgeData[] }).edges ?? [];
    const created: any[] = [];
    nodes.forEach((n) => {
      created.push(...importNode(n));
    });
    edges.forEach((e) => {
      created.push(...importEdge(e));
    });
    // Phase 7: wrap everything in one named board.
    const board = assembleBoard(created);
    if (board) {
      penpot.selection = [board];
    } else if (created.length) {
      penpot.selection = created;
    }
    penpot.ui.sendMessage({ type: "import-complete", count: created.length, board: !!board });
  }
});