/**
 * preview.ts - live Mermaid preview with debounce.
 * Renders the textarea content to SVG on a short debounce so the user sees
 * their diagram while typing, without thrashing mermaid on every keystroke.
 */

import mermaid from "mermaid";

let timer: ReturnType<typeof setTimeout> | null = null;
let renderSeq = 0;

/**
 * Debounced preview render.
 * - Clears the host + status when text is empty.
 * - On success, clears error class/status so stale errors don't linger after
 *   the user fixes the diagram (Phase 8 bug found in live testing).
 * - Uses a UNIQUE render id per call - mermaid.render can cache by element id
 *   and fail on reuse; unique ids make repeated previews safe.
 */
export function schedulePreview(
  text: string,
  host: HTMLElement,
  statusEl: HTMLElement,
  onError: (msg: string) => void
): void {
  if (timer) clearTimeout(timer);
  if (!text.trim()) {
    host.innerHTML = "";
    statusEl.textContent = "";
    statusEl.classList.remove("error");
    return;
  }
  timer = setTimeout(async () => {
    renderSeq += 1;
    const renderId = `graphDiv-${renderSeq}`;
    try {
      const { svg } = await mermaid.render(renderId, text);
      host.innerHTML = svg;
      // Clear any stale error from a previous attempt.
      statusEl.textContent = "";
      statusEl.classList.remove("error");
    } catch (e) {
      host.innerHTML = "";
      onError(friendlyError(String(e)));
    }
  }, 350);
}

/** Convert a raw mermaid error string into a friendly, line-aware message. */
export function friendlyError(raw: string): string {
  // mermaid errors often look like: "Error: Parse error on line 3: ..."
  const lineMatch = /line\s+(\d+)/i.exec(raw);
  if (lineMatch) {
    return `Mermaid could not parse this - check line ${lineMatch[1]}.`;
  }
  if (/syntax|parse|unexpected|expect|already in use/i.test(raw)) {
    return "Mermaid could not parse this - check the syntax.";
  }
  return "Something went wrong rendering the diagram.";
}