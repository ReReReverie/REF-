export type VerdictKey = "no-foul" | "yellow" | "red";

export type CaptionTier = "base" | "strong" | "multiple";

export type Verdict = {
  key: VerdictKey;
  label: string;
  shortLabel: string;
  color: string;
  ruling: string;
  notes: readonly [string, string];
  tier: CaptionTier;
};

export const MAX_CAPTION_LENGTH = 240;

const VERDICT_KEYS: readonly VerdictKey[] = ["no-foul", "yellow", "red"];

const WEIGHTS: Record<CaptionTier, readonly [number, number, number]> = {
  base: [45, 35, 20],
  strong: [35, 40, 25],
  multiple: [25, 40, 35],
};

const MULTIPLE_PHRASES = [
  "two women",
  "two girls",
  "two dates",
  "two girlfriends",
  "2 women",
  "2 girls",
  "2 dates",
  "2 girlfriends",
  "both women",
  "both girls",
  "at once",
  "multiple women",
  "multiple dates",
  "simultaneously",
] as const;

const STRONG_PHRASES = [
  "out of his league",
  "out of their league",
  "somehow pulled",
  "too much game",
  "rizz",
  "how did he",
  "way above his league",
] as const;

type VerdictTemplate = Omit<Verdict, "ruling" | "notes" | "tier">;

const VERDICT_TEMPLATES: Record<VerdictKey, VerdictTemplate> = {
  "no-foul": {
    key: "no-foul",
    label: "NO FOUL",
    shortLabel: "Play on",
    color: "#23d68a",
  },
  yellow: {
    key: "yellow",
    label: "YELLOW CARD",
    shortLabel: "Caution",
    color: "#f7df32",
  },
  red: {
    key: "red",
    label: "RED CARD",
    shortLabel: "Sent off",
    color: "#ff4e45",
  },
};

const RULINGS: Record<VerdictKey, string> = {
  "no-foul": "NO FOUL — game recognizes game. Play on.",
  yellow: "YELLOW CARD — suspicious levels of rizz call for a caution.",
  red: "RED CARD — illegally outside his league; the fictional call stands.",
};

const VERDICT_NOTES: Record<VerdictKey, string> = {
  "no-foul": "VAR note: Game recognizes game, so the fictional whistle stays quiet.",
  yellow: "VAR note: Suspicious rizz levels earn a fictional caution stamp.",
  red: "VAR note: The league ruling gets a fictional send-off stamp.",
};

const TIER_NOTES: Record<CaptionTier, string> = {
  base: "VAR note: Ordinary confidence keeps the transfer paperwork pleasantly light.",
  strong: "VAR note: An elevated rizz differential has the fictional booth on alert.",
  multiple: "VAR note: Multiple signings in one window create extra fictional VAR paperwork.",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a phrase matcher that only accepts a complete phrase. This deliberately
 * avoids substring matches such as `rizz` in `rizzler` or `2 women` in `2 womenhood`.
 */
function phrasePattern(phrase: string): RegExp {
  const words = phrase.split(/\s+/).map(escapeRegExp).join("\\s+");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${words}(?=$|[^\\p{L}\\p{N}_])`, "iu");
}

const MULTIPLE_PATTERNS = MULTIPLE_PHRASES.map(phrasePattern);
const STRONG_PATTERNS = STRONG_PHRASES.map(phrasePattern);

function boundedCaption(caption: string): string {
  return typeof caption === "string" ? caption.slice(0, MAX_CAPTION_LENGTH) : "";
}

/**
 * Classify only explicit, complete cue phrases. A caption with no known phrase
 * remains at the neutral base tier; unrelated words are intentionally ignored.
 */
export function classifyCaption(caption: string): CaptionTier {
  const value = boundedCaption(caption);

  if (MULTIPLE_PATTERNS.some((pattern) => pattern.test(value))) return "multiple";
  if (STRONG_PATTERNS.some((pattern) => pattern.test(value))) return "strong";
  return "base";
}

function isVerdictKey(value: unknown): value is VerdictKey {
  return typeof value === "string" && VERDICT_KEYS.includes(value as VerdictKey);
}

function assertRandomValue(randomValue: number): void {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError("randomValue must be a finite number in [0, 1).");
  }
}

/**
 * Select a verdict from a tier's weighted distribution. When a previous key is
 * provided its weight is removed before selection, so the remaining weights are
 * renormalized and a review-again call can never repeat the same verdict.
 */
export function selectVerdictKey(
  tier: CaptionTier,
  randomValue: number,
  previousKey?: VerdictKey,
): VerdictKey {
  assertRandomValue(randomValue);

  if (!Object.hasOwn(WEIGHTS, tier)) {
    throw new TypeError(`Unknown caption tier: ${String(tier)}`);
  }
  if (previousKey !== undefined && previousKey !== null && !isVerdictKey(previousKey)) {
    throw new TypeError(`Unknown verdict key: ${String(previousKey)}`);
  }

  const weights = WEIGHTS[tier];
  const activeKeys = VERDICT_KEYS.filter((key) => key !== previousKey);
  const total = activeKeys.reduce((sum, key) => sum + weights[VERDICT_KEYS.indexOf(key)], 0);
  let threshold = randomValue * total;

  for (const key of activeKeys) {
    threshold -= weights[VERDICT_KEYS.indexOf(key)];
    if (threshold < 0) return key;
  }

  // Floating point arithmetic can leave a tiny positive remainder at the top
  // boundary. The input contract excludes 1, so the final active key is safe.
  return activeKeys[activeKeys.length - 1];
}

/** Return a cryptographically generated value in the half-open range [0, 1). */
export function cryptoRandom(): number {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Secure randomness is unavailable in this environment.");
  }

  const values = new Uint32Array(1);
  cryptoApi.getRandomValues(values);
  return values[0] / 0x1_0000_0000;
}

export function makeVerdict(
  caption: string,
  randomValue: number,
  previousKey?: VerdictKey,
): Verdict {
  const tier = classifyCaption(caption);
  const key = selectVerdictKey(tier, randomValue, previousKey);
  const template = VERDICT_TEMPLATES[key];

  return {
    ...template,
    tier,
    ruling: RULINGS[key],
    notes: [VERDICT_NOTES[key], TIER_NOTES[tier]],
  };
}
