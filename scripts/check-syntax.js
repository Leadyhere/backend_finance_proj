import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["src", "scripts", "test", "public"];
const files = [];

const walk = (path) => {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) walk(entryPath);
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(entryPath);
  }
};

for (const root of roots) {
  if (statSync(root, { throwIfNoEntry: false })?.isDirectory()) walk(root);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
