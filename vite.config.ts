import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const monorepoRoot = resolve(__dirname, "../..");

function isVercelMonorepoBuild() {
  if (process.env.VERCEL !== "1") {
    return false;
  }

  const initialCwd = process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : "";

  if (initialCwd !== monorepoRoot) {
    return false;
  }

  const packageJsonPath = resolve(monorepoRoot, "package.json");

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  return Array.isArray(packageJson.workspaces) && packageJson.workspaces.includes("apps/web");
}

const vercelMonorepoBuild = isVercelMonorepoBuild();

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: vercelMonorepoBuild ? resolve(monorepoRoot, "dist") : "dist",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src")
    }
  },
  server: {
    port: 5173
  }
});
