import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8010"
    }
  },
  preview: {
    allowedHosts: [
      "frontend-production-20dd.up.railway.app",
      ...(process.env.VITE_ALLOWED_HOSTS?.split(",").map((host) => host.trim()).filter(Boolean) ?? [])
    ]
  }
});
