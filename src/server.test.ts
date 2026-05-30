import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createProductionClientAssets } from "./server";

const cleanup: string[] = [];

afterEach(() => {
  while (cleanup.length > 0) {
    const dir = cleanup.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createClientAssetsFixture() {
  const dir = mkdtempSync(join(tmpdir(), "excali-client-assets-"));
  cleanup.push(dir);

  writeFileSync(join(dir, "index.html"), "<!doctype html><html><body>ok</body></html>");
  writeFileSync(join(dir, "index-abc123.js"), "console.log('ok');");
  writeFileSync(join(dir, "index-abc123.js.br"), "compressed-brotli");

  return createProductionClientAssets(
    {
      index: "./index.html",
      files: [
        {
          path: "./index.html",
          loader: "html",
          headers: {
            "content-type": "text/html;charset=utf-8",
          },
        },
        {
          path: "./index-abc123.js",
          loader: "js",
          headers: {
            "content-type": "text/javascript;charset=utf-8",
          },
        },
      ],
    },
    pathToFileURL(`${dir}/`),
  );
}

describe("production client assets", () => {
  test("serves the HTML shell with revalidation headers", async () => {
    const assets = createClientAssetsFixture();

    const response = assets.serveHtml(new Request("http://local/d/abc123"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("etag")).toBeNull();
    expect(await response.text()).toContain("<!doctype html>");
  });

  test("serves immutable hashed assets as Brotli", async () => {
    const assets = createClientAssetsFixture();

    const response = assets.serveAsset(
      new Request("http://local/index-abc123.js", {
        headers: {
          "accept-encoding": "gzip, br",
        },
      }),
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response?.headers.get("content-encoding")).toBe("br");
    expect(response?.headers.get("vary")).toBe("Accept-Encoding");
    expect(response?.headers.get("etag")).toBeNull();
    expect(await response?.text()).toBe("compressed-brotli");
  });

  test("rejects asset requests without Brotli support", async () => {
    const assets = createClientAssetsFixture();

    const response = assets.serveAsset(
      new Request("http://local/index-abc123.js", {
        headers: {
          "accept-encoding": "gzip",
        },
      }),
    );

    expect(response?.status).toBe(406);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("vary")).toBe("Accept-Encoding");
    expect(await response?.text()).toBe("Brotli encoding is required");
  });
});
