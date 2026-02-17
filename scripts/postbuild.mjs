/**
 * postbuild.mjs
 *
 * Ensures dist/index.js has a Node shebang and is executable.
 * TypeScript's tsc strips shebangs from compiled output, so this
 * script re-adds it after every build.
 */

import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, "..", "dist", "index.js");

const SHEBANG = "#!/usr/bin/env node\n";

const contents = readFileSync(target, "utf-8");

if (!contents.startsWith("#!")) {
  writeFileSync(target, SHEBANG + contents, "utf-8");
  console.log("Prepended shebang to dist/index.js");
} else {
  console.log("dist/index.js already has a shebang");
}

chmodSync(target, 0o755);
console.log("Set dist/index.js as executable");
