import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/project-pulse/" : "/",
  plugins: [react()],
  build: {
    outDir: "dist/client",
    sourcemap: true,
  }
});
