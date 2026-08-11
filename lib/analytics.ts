export const ANALYTICS_CONSENT_KEY = "ref.analyticsConsent";

export type AnalyticsConsent = "accepted" | "declined";

const VERDICTS = ["no-foul", "yellow", "red"] as const;
type Verdict = (typeof VERDICTS)[number];

export type AnalyticsEventPayloads = {
  evidence_added: { image_count: number };
  verdict_completed: { verdict: Verdict; review_count: number };
  review_again: { previous_verdict: Verdict };
};

export type AnalyticsEventName = keyof AnalyticsEventPayloads;

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/u;

export function getAnalyticsMeasurementId(value: string | undefined): string | null {
  const normalizedValue = value?.trim();
  return normalizedValue && MEASUREMENT_ID_PATTERN.test(normalizedValue) ? normalizedValue : null;
}

export function shouldLoadAnalytics(
  measurementId: string | null,
  choice: AnalyticsConsent | null,
): boolean {
  return measurementId !== null && choice === "accepted";
}

const ALLOWED_EVENT_KEYS: Record<AnalyticsEventName, readonly string[]> = {
  evidence_added: ["image_count"],
  verdict_completed: ["verdict", "review_count"],
  review_again: ["previous_verdict"],
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function readAnalyticsConsent(storage: Pick<Storage, "getItem">): AnalyticsConsent | null {
  try {
    const value = storage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(
  storage: Pick<Storage, "setItem">,
  value: AnalyticsConsent,
): void {
  storage.setItem(ANALYTICS_CONSENT_KEY, value);
}

export function readBrowserAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;

  try {
    return readAnalyticsConsent(window.localStorage);
  } catch {
    return null;
  }
}

export function writeBrowserAnalyticsConsent(value: AnalyticsConsent): void {
  if (typeof window === "undefined") return;

  try {
    writeAnalyticsConsent(window.localStorage, value);
  } catch {
    // Analytics is optional; storage failures must not interrupt the referee.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactOwnKeys(payload: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  try {
    const prototype = Object.getPrototypeOf(payload);
    if (prototype !== Object.prototype && prototype !== null) return false;

    const ownKeys = Reflect.ownKeys(payload);
    return (
      ownKeys.length === allowedKeys.length &&
      allowedKeys.every((key) => ownKeys.includes(key))
    );
  } catch {
    return false;
  }
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && VERDICTS.includes(value as Verdict);
}

export function isSafeAnalyticsPayload(
  eventName: string,
  payload: unknown,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_EVENT_KEYS, eventName)) return false;
  if (!isRecord(payload)) return false;

  const allowedKeys = ALLOWED_EVENT_KEYS[eventName as AnalyticsEventName];
  if (!hasExactOwnKeys(payload, allowedKeys)) return false;

  switch (eventName) {
    case "evidence_added":
      return isCount(payload.image_count);
    case "verdict_completed":
      return isVerdict(payload.verdict) && isCount(payload.review_count);
    case "review_again":
      return isVerdict(payload.previous_verdict);
    default:
      return false;
  }
}

export function trackAnalyticsEvent<EventName extends AnalyticsEventName>(
  eventName: EventName,
  payload: AnalyticsEventPayloads[EventName],
): void {
  if (typeof window === "undefined") return;
  if (readBrowserAnalyticsConsent() !== "accepted") return;
  if (typeof window.gtag !== "function") return;
  if (!isSafeAnalyticsPayload(eventName, payload)) return;

  window.gtag("event", eventName, payload);
}
