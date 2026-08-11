import assert from "node:assert/strict";
import test from "node:test";
import { isIndexableDeployment } from "../lib/site-url.ts";

const baseUrl = new URL(process.env.REF_TEST_BASE_URL ?? "http://localhost:3000/");
const deployment = process.env.REF_TEST_DEPLOYMENT ?? "production";
const expectedOrigin = new URL(
  process.env.REF_TEST_CANONICAL ?? baseUrl.toString(),
).origin;
const expectedStructuredDataUrl = new URL("/", expectedOrigin).toString();
const expectedIndexable = deployment === "production";

const expectedTitle = "Meme Referee \u2013 Get a Funny VAR Verdict | REF?";
const expectedDescription =
  "Upload a photo, add context, and let REF? settle the group chat with a funny no-foul, yellow-card, or red-card meme verdict. Free and private.";

test("only production is indexable; preview, development, and local are blocked", () => {
  assert.equal(isIndexableDeployment("production"), true);
  for (const environment of ["preview", "development", "test", ""]) {
    assert.equal(isIndexableDeployment(environment), false, environment ?? "unset");
  }

  const previousEnvironment = process.env.VERCEL_ENV;
  try {
    delete process.env.VERCEL_ENV;
    assert.equal(isIndexableDeployment(), false, "unset");
  } finally {
    if (previousEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousEnvironment;
    }
  }
});

function escapeRegExp(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function readAttribute(tag, attribute) {
  const match = tag.match(
    new RegExp("\\b" + escapeRegExp(attribute) + "\\s*=\\s*([\"'])(.*?)\\1", "iu"),
  );
  return match?.[2] ?? null;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#x27;|&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&#(\d+);/gu, (_match, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([0-9a-f]+);/giu, (_match, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    );
}

function textContent(fragment) {
  return decodeHtml(fragment.replace(/<[^>]*>/gu, " ")).replace(/\s+/gu, " ").trim();
}

function findMeta(html, attribute, value) {
  const tags = html.match(/<meta\b[^>]*>/giu) ?? [];
  const tag = tags.find(
    (candidate) => readAttribute(candidate, attribute)?.toLowerCase() === value.toLowerCase(),
  );
  return tag ? readAttribute(tag, "content") : null;
}

function findCanonical(html) {
  const tags = html.match(/<link\b[^>]*>/giu) ?? [];
  const canonical = tags.find((tag) =>
    (readAttribute(tag, "rel") ?? "").split(/\s+/u).includes("canonical"),
  );
  return canonical ? readAttribute(canonical, "href") : null;
}

function visibleText(html) {
  return textContent(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " "),
  );
}

async function get(pathname) {
  const response = await fetch(new URL(pathname, baseUrl), {
    headers: { accept: pathname === "/" ? "text/html" : "*/*" },
    redirect: "manual",
  });
  return { response, body: await response.text() };
}

test("production HTTP homepage exposes the complete SEO contract (" + deployment + ")", async () => {
  const { response, body } = await get("/");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/iu);

  const h1Matches = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)];
  assert.equal(h1Matches.length, 1, "the landing page must contain exactly one H1");
  assert.equal(textContent(h1Matches[0][1]), "REF, IS THIS ALLOWED?");

  const title = body.match(/<title>([\s\S]*?)<\/title>/iu)?.[1];
  assert.equal(title === undefined ? null : decodeHtml(title), expectedTitle);
  assert.equal(findMeta(body, "name", "description"), expectedDescription);
  assert.equal(findCanonical(body), expectedOrigin);

  assert.equal(findMeta(body, "property", "og:type"), "website");
  assert.equal(findMeta(body, "property", "og:url"), expectedOrigin);
  assert.equal(findMeta(body, "property", "og:site_name"), "REF?");
  assert.equal(findMeta(body, "property", "og:title"), expectedTitle);
  assert.equal(findMeta(body, "property", "og:description"), expectedDescription);
  assert.equal(findMeta(body, "property", "og:image"), new URL("og.png", expectedOrigin).toString());
  assert.equal(findMeta(body, "property", "og:image:width"), "1200");
  assert.equal(findMeta(body, "property", "og:image:height"), "630");
  assert.equal(findMeta(body, "name", "twitter:card"), "summary_large_image");
  assert.equal(findMeta(body, "name", "twitter:title"), expectedTitle);
  assert.equal(findMeta(body, "name", "twitter:description"), expectedDescription);
  assert.equal(findMeta(body, "name", "twitter:image"), new URL("og.png", expectedOrigin).toString());

  const jsonLdMatches = [
    ...body.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu,
    ),
  ];
  assert.ok(jsonLdMatches.length > 0, "the page must include JSON-LD");
  const structuredData = jsonLdMatches.map((match) => JSON.parse(match[1].trim()));
  const application = structuredData.find((value) => value?.["@type"] === "WebApplication");
  assert.ok(application, "JSON-LD must contain a WebApplication object");
  assert.equal(application["@context"], "https://schema.org");
  assert.equal(application.name, "REF?");
  assert.equal(application.url, expectedStructuredDataUrl);
  assert.equal(application.description, expectedDescription);
  assert.equal(application.applicationCategory, "EntertainmentApplication");
  assert.equal(application.operatingSystem, "Any");
  assert.equal(application.browserRequirements, "Requires a modern browser with JavaScript enabled.");
  assert.equal(application.isAccessibleForFree, true);
  assert.equal(application.image, new URL("og.png", expectedOrigin).toString());
  assert.deepEqual(application.offers, {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  });

  const pageText = visibleText(body);
  assert.match(pageText, /free\s+browser-based meme referee/iu);
  assert.match(pageText, /group chat/iu);
  assert.match(pageText, /no-foul, yellow-card, or red-card/iu);
  assert.match(pageText, /photos stay local in your browser and are never uploaded or inspected/iu);
  assert.match(pageText, /caption cues plus randomness, not image analysis or AI analysis/iu);
  assert.match(body, /id=["']how-it-works["']/iu);
  assert.match(body, /class=["'][^"']*uses-section[^"']*["']/iu);
  assert.match(body, /class=["'][^"']*faq-section[^"']*["']/iu);
  assert.equal((body.match(/<details\b/giu) ?? []).length, 4);
  assert.doesNotMatch(pageText, /\b(?:AI-powered|AI powered|artificial intelligence powered)\b/iu);
  assert.doesNotMatch(
    pageText,
    /\b(?:we|ref\?|the referee|this tool)\s+(?:analy[sz]e|inspect|interpret|understand|detect|recognize|judge)s?\s+(?:your\s+)?(?:image|photo|pixels?)\b/iu,
  );
  assert.doesNotMatch(pageText, /stud(?:y|ies)\s+every\s+pixel|enhanc(?:e|ing)\s+pixels/iu);

  const robotsMeta = findMeta(body, "name", "robots") ?? "";
  if (expectedIndexable) {
    assert.match(robotsMeta, /\bindex\b/iu);
    assert.match(robotsMeta, /\bfollow\b/iu);
    assert.doesNotMatch(robotsMeta, /noindex|nofollow/iu);
  } else {
    assert.match(robotsMeta, /noindex/iu);
    assert.match(robotsMeta, /nofollow/iu);
  }
});

test("production HTTP robots policy matches " + deployment + " indexing mode", async () => {
  const { response, body } = await get("/robots.txt");
  const sitemapUrl = new URL("sitemap.xml", expectedOrigin).toString();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain\b/iu);
  assert.match(body, /^User-agent: \*$/miu);

  if (expectedIndexable) {
    assert.match(body, /^Allow: \/$/mu);
    assert.match(body, new RegExp("^Sitemap: " + escapeRegExp(sitemapUrl) + "$", "mu"));
    assert.match(body, new RegExp("^Host: " + escapeRegExp(expectedOrigin) + "$", "mu"));
    assert.doesNotMatch(body, /^Disallow: \/$/mu);
  } else {
    assert.match(body, /^Disallow: \/$/mu);
    assert.doesNotMatch(body, /^Allow: \/$/mu);
    assert.doesNotMatch(body, /^Sitemap:/mu);
    assert.doesNotMatch(body, /^Host:/mu);
  }
});

test("production HTTP sitemap matches " + deployment + " indexing mode", async () => {
  const { response, body } = await get("/sitemap.xml");
  const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/giu)].map((match) => decodeHtml(match[1]));

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /xml/iu);
  assert.match(
    body,
    /<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/iu,
  );

  if (expectedIndexable) {
    assert.deepEqual(locations, [expectedStructuredDataUrl]);
  } else {
    assert.deepEqual(locations, []);
  }
});
