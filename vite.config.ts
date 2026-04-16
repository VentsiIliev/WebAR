import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

console.log("Vite config loaded");

export default defineConfig({
  plugins: [mkcert()],
  server: {
    host: true,
    https: true,
    strictPort: true,
    port: 5173,
  },
});
