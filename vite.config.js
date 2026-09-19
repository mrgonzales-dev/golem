const { defineConfig } = require("vite");
const vue = require("@vitejs/plugin-vue");
const path = require("path");

module.exports = defineConfig({
  plugins: [vue()],
  root: "src/renderer",
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  test: {
    root: ".",
    include: ["test/**/*.test.ts"],
    globals: true,
    setupFiles: ["test/setup.js"],
  },
});
