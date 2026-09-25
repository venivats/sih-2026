import { spawnSync } from "node:child_process";
// This build target is explicitly connected. Sites/static builds keep their existing mode.
const result = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, VITE_API_BASE_URL: "/api" },
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
