import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the context-aware meme referee", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>REF\? — The Internet(?:&#x27;|')s Meme Referee<\/title>/i);
  assert.match(html, /REF, IS THIS/);
  assert.match(html, /Add a caption for context/);
  assert.match(html, /GAME RECOGNIZES GAME/);
  assert.doesNotMatch(html, /studies every pixel|enhancing pixels|codex-preview|react-loading-skeleton/i);
});

test("ships the finished caption workflow and social metadata", async () => {
  const [layout, page, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /REF\? — The Internet's Meme Referee/);
  assert.match(layout, /\/og-rizz\.png/);
  assert.match(page, /maxLength=\{MAX_CAPTION_LENGTH\}/);
  assert.match(page, /cryptoRandom\(\)/);
  assert.match(page, /FICTIONAL VAR NOTES/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", root)));
});
