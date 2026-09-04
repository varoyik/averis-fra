import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "geojson-loader",
      enforce: "pre",
      async load(id) {
        if (id.endsWith(".geojson")) {
          const source = await readFile(id, "utf-8");
          return `export default ${source};`;
        }
      },
    },
  ],
});
