import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import gltf from "vite-plugin-gltf";
import svgr from "vite-plugin-svgr";
import { draco } from "@gltf-transform/functions";

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    gltf({
      transforms: [draco()],
    }),
  ],
  root: "src",
  build: {
    outDir: "../",
  },
});
