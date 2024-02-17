import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import gltf from "vite-plugin-gltf";
import { draco } from "@gltf-transform/functions";

export default defineConfig({
  plugins: [
    react(),
    gltf({
      transforms: [draco()],
    }),
  ],
  root: "src",
  build: {
    outDir: "../",
  },
});
