import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const distDir = resolve(import.meta.dir, "..", "dist");
const compressibleExtensions = [".css", ".js", ".json", ".svg", ".txt"];

function shouldCompress(name: string) {
  return compressibleExtensions.some((extension) => name.endsWith(extension));
}

mkdirSync(distDir, { recursive: true });

for (const name of readdirSync(distDir)) {
  const path = join(distDir, name);
  const stats = statSync(path);
  if (!stats.isFile() || !shouldCompress(name)) {
    continue;
  }

  const source = readFileSync(path);
  writeFileSync(
    `${path}.br`,
    brotliCompressSync(source, {
      params: {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
        [constants.BROTLI_PARAM_QUALITY]: 11,
      },
    }),
  );
}

console.log(`Compressed static assets in ${basename(distDir)}`);
