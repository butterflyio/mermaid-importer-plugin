import { defineConfig } from "vite";

// base maps where the plugin is served FROM. On GitHub Pages the site lives at
// the repo path: https://butterflyio.github.io/mermaid-importer-plugin/
// so absolute asset references need the /mermaid-importer-plugin/ prefix.
export default defineConfig({
  base: "/mermaid-importer-plugin/",
  build: {
    rollupOptions: {
      input: {
        plugin: "src/plugin.ts",
        index: "./index.html"
      },
      output: { entryFileNames: "[name].js" },
    },
    outDir: "dist",
  },
  server: { port: 4400 }
});