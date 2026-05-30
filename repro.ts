import { rmdir, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

async function main() {
  const testDir = join(process.cwd(), "bun-repro-dir");
  await rmdir(testDir, { recursive: true }).catch(() => {});
  await mkdir(testDir, { recursive: true });

  const numChunks = 2500;

  for (let i = 0; i < numChunks; i++) {
    await writeFile(join(testDir, `chunk${i}.js`), `export const val = ${i};\nconsole.log(val);`);
  }

  let entryFile = "import { x } from './entry1.js'; console.log(x);\n";
  let entry1File = "export const x = 1;\n";

  for (let i = 0; i < numChunks; i++) {
    entry1File += `import("./chunk${i}.js").then(m => console.log(m.val));\n`;
  }

  await writeFile(join(testDir, "entry1.js"), entry1File);
  await writeFile(join(testDir, "index.js"), entryFile);

  const htmlContent = `<!DOCTYPE html><html><head><script type="module" src="./index.js"></script></head><body></body></html>`;
  await writeFile(join(testDir, "index.html"), htmlContent);

  console.log("Building...");
  const child = spawn(process.argv[0], ["build", "--target=browser", "--splitting", "--outdir", "./dist", "./index.html"], {
    cwd: testDir,
    stdio: "inherit",
  });

  await new Promise((resolve) => child.on("close", resolve));

  const outputHtml = await readFile(join(testDir, "dist", "index.html"), "utf8");
  console.log("\nGenerated HTML (partial):");
  console.log(outputHtml.slice(0, 500));

  // Parse the injected script src
  const match = outputHtml.match(/src="([^"]+)"/);
  if (!match) {
    console.error("Failed to parse output HTML");
    process.exit(1);
  }

  const injectedScript = match[1];
  console.log(`\nInjected script: ${injectedScript}`);

  const injectedContent = await readFile(join(testDir, "dist", injectedScript), "utf8");
  if (injectedContent.includes('console.log(x)') || injectedContent.includes('console.log(1)')) {
     console.log("✅ Bun successfully injected the main entrypoint!");
  } else {
     console.log("❌ Bug confirmed: Bun injected a random chunk instead of the main entrypoint.");
  }
}

main().catch(console.error);
