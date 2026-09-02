import { defineConfig } from "vite";

// base maps where the plugin is served FROM. During dev/test on
// design.promptraise.com/spike/* this is "/spike/". Phase 9 deploys at the
// real origin root (or its own subdomain) and this becomes "/".
//
// BUILD CONSTRAINT (Phase 5): plugin.ts is written SELF-CONTAINED (no imports)
// because Penpot loads it as a classic script - any bundled `import` breaks it.
// Keep src/plugin.ts dependency-free; UI code (main.ts) can import freely.
export default defineConfig({
  base: "/spike/",
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