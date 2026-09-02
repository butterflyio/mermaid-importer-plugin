/**
 * UI entry (runs in the plugin iframe).
 *
 * PHASE 1 SPIKE FINDING: `penpot` global is NOT present in the UI iframe on
 * Penpot 2.16. The UI talks to the plugin code via window.parent.postMessage
 * with an event object { type }. That matches the working Tailwind plugins.
 *
 * PHASE 3: bundled mermaid.js renders the pasted text to SVG inside a hidden
 * container; we parse the SVG DOM to node/edge data and report the counts.
 *
 * PHASE 8: preview.ts handles the live debounced preview + friendly errors;
 * this file keeps the import flow (render -> extract -> postMessage).
 */

import mermaid from "mermaid";
import { extractNodes, extractEdges } from "./importer";
import { schedulePreview, friendlyError } from "./preview";

mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

const textarea = document.getElementById("mermaid-input") as HTMLTextAreaElement;
const importBtn = document.getElementById("import-btn") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const charCountEl = document.getElementById("char-count") as HTMLSpanElement;
const renderHost = document.getElementById("render-host") as HTMLDivElement;

function setStatus(msg: string, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

function updateCharCount() {
  charCountEl.textContent = `${textarea.value.length} chars`;
}

async function renderToSvg(text: string): Promise<{ svg: string; counts: Record<string, number>; firstLabel: string }> {
  const { svg } = await mermaid.render("graphDiv", text);
  renderHost.innerHTML = svg;
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const nodes = doc.querySelectorAll("g.nodes > g.node");
  const edgePaths = doc.querySelectorAll("g.edgePaths > path");
  const labels = doc.querySelectorAll("g.edgeLabels > foreignObject");

  const firstNode = nodes[0];
  let firstLabel = "none";
  if (firstNode) {
    const fo = firstNode.querySelector("foreignObject");
    if (fo) firstLabel = fo.textContent?.trim() ?? "empty";
  }

  return {
    svg,
    counts: { nodes: nodes.length, edges: edgePaths.length, labels: labels.length },
    firstLabel,
  };
}

function doRender(text: string, importAfter = false) {
  setStatus("Rendering...");
  renderToSvg(text)
    .then((r) => {
      const doc = new DOMParser().parseFromString(r.svg, "image/svg+xml");
      const nodesData = extractNodes(doc);
      const edgesData = extractEdges(doc);
      setStatus(`Rendered ${r.counts.nodes} nodes, ${r.counts.edges} edges.`);
      window.parent.postMessage(
        {
          type: importAfter ? "import-nodes" : "render-complete",
          counts: r.counts,
          firstLabel: r.firstLabel,
          nodes: nodesData,
          edges: edgesData,
          text,
        },
        "*"
      );
    })
    .catch((e) => {
      const friendly = friendlyError(String(e));
      setStatus(friendly, true);
      window.parent.postMessage({ type: "render-error", text: friendly }, "*");
    });
}

importBtn.addEventListener("click", () => {
  const text = textarea.value.trim();
  if (!text) {
    setStatus("Paste Mermaid text first.", true);
    return;
  }
  doRender(text, true);
});

clearBtn.addEventListener("click", () => {
  textarea.value = "";
  renderHost.innerHTML = "";
  updateCharCount();
  setStatus("Cleared.");
});

// Live preview: debounced render on input + character count.
textarea.addEventListener("input", () => {
  updateCharCount();
  schedulePreview(textarea.value, renderHost, statusEl, (msg) => setStatus(msg, true));
});

// Theme hook: Penpot sends the theme as a postMessage {type:"theme", theme:"..."}
// AND via the iframe URL ?theme= param (verified from the working Tailwind
// plugin UI). Apply both so dark/light themes the shell correctly.
function applyTheme(theme: string | null | undefined) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}
// Initial: read from URL param
applyTheme(new URLSearchParams(window.location.search).get("theme"));
window.addEventListener("message", (event) => {
  const data = event.data as { type?: string; theme?: string } | undefined;
  if (data?.type === "theme") {
    applyTheme(data.theme);
  }
});

updateCharCount();