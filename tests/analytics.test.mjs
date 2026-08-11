import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ANALYTICS_CONSENT_KEY,
  getAnalyticsMeasurementId,
  isSafeAnalyticsPayload,
  readAnalyticsConsent,
  readBrowserAnalyticsConsent,
  shouldLoadAnalytics,
  trackAnalyticsEvent,
  writeAnalyticsConsent,
  writeBrowserAnalyticsConsent,
} from "../lib/analytics.ts";

function createStorage(initialValue) {
  const values = new Map();
  if (initialValue !== undefined) values.set(ANALYTICS_CONSENT_KEY, initialValue);

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function installWindow(value) {
  const previousWindow = globalThis.window;
  globalThis.window = value;

  return () => {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  };
}

test("consent choices persist at the exact privacy key", () => {
  const storage = createStorage();

  assert.equal(readAnalyticsConsent(storage), null);
  writeAnalyticsConsent(storage, "accepted");
  assert.equal(storage.getItem(ANALYTICS_CONSENT_KEY), "accepted");
  assert.equal(readAnalyticsConsent(storage), "accepted");

  writeAnalyticsConsent(storage, "declined");
  assert.equal(storage.getItem(ANALYTICS_CONSENT_KEY), "declined");
  assert.equal(readAnalyticsConsent(storage), "declined");

  storage.setItem(ANALYTICS_CONSENT_KEY, "maybe");
  assert.equal(readAnalyticsConsent(storage), null);
});

test("browser consent helpers are no-ops without a usable browser store", () => {
  const restoreWindow = installWindow({ localStorage: createStorage() });
  try {
    assert.equal(readBrowserAnalyticsConsent(), null);
    writeBrowserAnalyticsConsent("accepted");
    assert.equal(readBrowserAnalyticsConsent(), "accepted");
  } finally {
    restoreWindow();
  }

  assert.equal(readBrowserAnalyticsConsent(), null);
  writeBrowserAnalyticsConsent("declined");
});

test("measurement IDs and consent gate keep analytics inactive when unconfigured or declined", () => {
  assert.equal(getAnalyticsMeasurementId(undefined), null);
  assert.equal(getAnalyticsMeasurementId(""), null);
  assert.equal(getAnalyticsMeasurementId(" G-ABC123 "), "G-ABC123");
  assert.equal(getAnalyticsMeasurementId("UA-12345"), null);

  assert.equal(shouldLoadAnalytics(null, "accepted"), false);
  assert.equal(shouldLoadAnalytics("G-ABC123", null), false);
  assert.equal(shouldLoadAnalytics("G-ABC123", "declined"), false);
  assert.equal(shouldLoadAnalytics("G-ABC123", "accepted"), true);
});

test("only the three exact, content-free event schemas are accepted", () => {
  assert.equal(isSafeAnalyticsPayload("evidence_added", { image_count: 2 }), true);
  assert.equal(
    isSafeAnalyticsPayload("verdict_completed", { verdict: "yellow", review_count: 1 }),
    true,
  );
  assert.equal(isSafeAnalyticsPayload("review_again", { previous_verdict: "red" }), true);

  for (const key of ["filename", "caption", "image", "object_url", "extra"]) {
    const payload = { image_count: 1, [key]: "private user content" };
    assert.equal(
      isSafeAnalyticsPayload("evidence_added", payload),
      false,
      `rejects ${key} from evidence_added`,
    );
  }

  assert.equal(isSafeAnalyticsPayload("evidence_added", {}), false);
  assert.equal(isSafeAnalyticsPayload("evidence_added", { image_count: 1.5 }), false);
  assert.equal(isSafeAnalyticsPayload("evidence_added", { image_count: -1 }), false);
  assert.equal(
    isSafeAnalyticsPayload("verdict_completed", { verdict: "caption text", review_count: 1 }),
    false,
  );
  assert.equal(
    isSafeAnalyticsPayload("verdict_completed", { verdict: "red", review_count: 1, caption: "x" }),
    false,
  );
  assert.equal(isSafeAnalyticsPayload("review_again", { previous_verdict: "blue" }), false);
  assert.equal(isSafeAnalyticsPayload("unknown_event", { image_count: 1 }), false);

  const inheritedContent = Object.create({ caption: "private caption" });
  inheritedContent.image_count = 1;
  assert.equal(isSafeAnalyticsPayload("evidence_added", inheritedContent), false);

  const hiddenContent = { image_count: 1 };
  Object.defineProperty(hiddenContent, "object_url", { value: "blob:private" });
  assert.equal(isSafeAnalyticsPayload("evidence_added", hiddenContent), false);
});

test("tracking is a no-op before acceptance and sends only the approved schema", () => {
  const calls = [];
  const storage = createStorage("declined");
  const restoreWindow = installWindow({
    localStorage: storage,
    gtag(...args) {
      calls.push(args);
    },
  });

  try {
    trackAnalyticsEvent("evidence_added", { image_count: 1 });
    assert.deepEqual(calls, []);

    writeAnalyticsConsent(storage, "accepted");
    trackAnalyticsEvent("evidence_added", { image_count: 2 });
    trackAnalyticsEvent("evidence_added", {
      image_count: 2,
      filename: "private.jpg",
    });
    trackAnalyticsEvent("verdict_completed", { verdict: "red", review_count: 1 });
    trackAnalyticsEvent("review_again", { previous_verdict: "red" });

    assert.deepEqual(calls, [
      ["event", "evidence_added", { image_count: 2 }],
      ["event", "verdict_completed", { verdict: "red", review_count: 1 }],
      ["event", "review_again", { previous_verdict: "red" }],
    ]);
  } finally {
    restoreWindow();
  }
});

test("the consent control gates scripts and exposes a settings reopen path", async () => {
  const source = await readFile(new URL("../app/analytics-consent.tsx", import.meta.url), "utf8");
  const gateIndex = source.indexOf("{shouldLoadAnalytics(measurementId, choice) && (");
  const scriptIndex = source.indexOf("<Script", gateIndex);

  assert.ok(gateIndex >= 0, "GA4 scripts are wrapped in the consent gate");
  assert.ok(scriptIndex > gateIndex, "GA4 scripts occur inside the consent gate");
  assert.match(source, /if \(!measurementId \|\| typeof window === "undefined"\)/u);
  assert.match(source, /return measurementId \? readBrowserAnalyticsConsent\(\) : null/u);
  assert.match(source, /writeBrowserAnalyticsConsent\(nextChoice\)/u);
  assert.match(source, /setIsSettingsOpen\(true\)/u);
  assert.match(source, /setIsSettingsOpen\(false\)/u);
  assert.match(source, /ref:analytics-consent-change/u);
});
