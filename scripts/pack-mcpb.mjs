/**
 * pack-mcpb.mjs
 *
 * Creates a slim MCPB bundle by staging only production files
 * into a temp directory before packing. This avoids bundling
 * devDependencies that leak in from file:-linked packages.
 *
 * For local dev (file: links), it replaces broken symlinks
 * with the actual library files. In CI, npm ci resolves from
 * the GitHub Packages registry directly.
 */

import {
  mkdtempSync, cpSync, rmSync, existsSync,
  mkdirSync, realpathSync, lstatSync, unlinkSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const stage = mkdtempSync(join(tmpdir(), "mcpb-"));
console.log(`Staging in ${stage}`);

try {
  // Copy only what the bundle needs
  for (const item of ["dist", "manifest.json", "package.json", "package-lock.json", "README.md", ".npmrc"]) {
    try {
      cpSync(join(root, item), join(stage, item), { recursive: true });
    } catch {
      // .npmrc or README.md may not exist — that's fine
    }
  }

  // Production-only install
  execSync("npm ci --omit=dev", { cwd: stage, stdio: "inherit" });

  // Handle broken symlinks from file: dependencies (local dev only).
  // npm ci creates a symlink like node-teamdynamix -> ../../../node-teamdynamix
  // which doesn't resolve from the temp dir.
  const linkedPkg = join(stage, "node_modules", "@chatt-state", "node-teamdynamix");

  let isBrokenLink = false;
  try {
    lstatSync(linkedPkg); // succeeds even for broken symlinks
    isBrokenLink = !existsSync(linkedPkg); // existsSync follows symlinks — false if target missing
  } catch {
    // doesn't exist at all
  }

  if (isBrokenLink || !existsSync(linkedPkg)) {
    console.log("Copying @chatt-state/node-teamdynamix from local link...");
    const localPkg = join(root, "node_modules", "@chatt-state", "node-teamdynamix");
    const realPath = realpathSync(localPkg);

    // Remove broken symlink if present
    try { unlinkSync(linkedPkg); } catch { /* noop */ }

    // Copy only dist + package.json from the library (no devDependencies)
    mkdirSync(linkedPkg, { recursive: true });
    cpSync(join(realPath, "dist"), join(linkedPkg, "dist"), { recursive: true });
    cpSync(join(realPath, "package.json"), join(linkedPkg, "package.json"));
  }

  // Pack from staging dir, output to project root
  const outFile = join(root, "teamdynamix-mcp-server.mcpb");
  const mcpb = join(root, "node_modules", ".bin", "mcpb");
  execSync(`"${mcpb}" pack "${stage}" "${outFile}"`, { cwd: root, stdio: "inherit" });

  console.log(`\nDone! Bundle written to project root.`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
