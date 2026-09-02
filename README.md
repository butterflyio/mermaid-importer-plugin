# Mermaid Importer for Penpot

Turn Mermaid flowchart text into native, editable Penpot shapes - nodes, edges,
arrowheads, and labels wrapped in a single named board.

The first Mermaid importer on the Penpot plugin catalog.

## Install

1. Open any file in [Penpot](https://penpot.app) (or your self-hosted instance).
2. Open the Plugins panel (`Ctrl+Alt+P` / the plugins icon).
3. Paste this URL into the install box:

```
https://butterflyio.github.io/mermaid-importer-plugin/manifest.json
```

4. Accept the permissions dialog - it needs read/write on file content to create
   the diagram shapes.

## Usage

1. Open the plugin from the Plugins panel.
2. Paste a Mermaid flowchart (currently `flowchart TD`/`LR` and related flowchart
   styles; sequence/ER/gantt are v2).
3. Preview updates live as you type.
4. Click **Import** - the diagram lands in your page as one selectable board
   named `Mermaid Diagram - <date>`.

Supports: rectangle / stadium / diamond (rhombus) / ellipse nodes, edge paths
with arrowheads, and branch labels (e.g. `Yes` / `No`). Everything is native
Penpot: path, rect, text objects with real fills/strokes/fonts - not an image.

## How it works

1. Bundled [mermaid.js](https://mermaid.js.org) renders the source to SVG
   inside the plugin iframe (fully offline - no network at runtime).
2. The SVG DOM is parsed into nodes (`g.nodes > g.node`), edges
   (`g.edgePaths > path`), arrowheads, and labels (`g.edgeLabels`).
3. Path `d` strings are passed straight to `penpot.createPath().content` -
   [Penpot's documented `PathCommand[]` array format is silently ignored on
   2.16.x (`penpot/penpot-plugins` #209); the string form works exactly].
4. All objects are created via the plugin API and nested into one board with
   `board.appendChild()`.

## Development

```bash
npm install
npm run build      # tsc + vite -> dist/
npm test           # vitest (pathconverter string-passthrough)
```

**Build constraint:** `src/plugin.ts` must stay self-contained (zero imports) -
Penpot loads plugin code as a classic script, and any bundled `import` breaks it
silently. UI code (`src/main.ts`) can import freely.

The GitHub Actions workflow builds `dist/`, copies `manifest.json` into it
(Vite does not emit it), and deploys to GitHub Pages.

## License

[MIT](./LICENSE)

## Report a bug

Open an issue on this repository. For the self-hosted instance, include your
Penpot version (the plugin targets 2.16+).