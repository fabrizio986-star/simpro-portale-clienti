import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        capofficina: resolve(__dirname, "capofficina.html"),
        officina: resolve(__dirname, "officina.html"),
      },
    },
  },
});
