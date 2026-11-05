import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Apache serves this project at http://localhost/mibase_checkout (the folder
// must be htdocs/mibase_checkout). In dev, Vite proxies the PHP API and toy
// photos to Apache, so Apache must be running.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/mibase_checkout/",
  server: {
    port: 5175,
    proxy: {
      "/api_public": {
        target: "http://localhost",
        changeOrigin: true,
        rewrite: (path) => `/mibase_checkout${path}`,
      },
      "/toy_images": {
        target: "http://localhost",
        changeOrigin: true,
      },
    },
  },
});
