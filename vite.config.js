import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";
import { resolve } from "path";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default {
  base: "./",
  resolve: {
    alias: {
      "@packages": resolve(__dirname, "packages"),
    },
  },
  plugins: [react(), glsl(), basicSsl()],
  server: {
    host: true,
    https: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
};
