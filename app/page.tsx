"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  MAX_CAPTION_LENGTH,
  cryptoRandom,
  makeVerdict,
  type Verdict,
  type VerdictKey,
} from "./referee";
import AnalyticsConsentControl from "./analytics-consent";
import { trackAnalyticsEvent } from "@/lib/analytics";

type ReviewPhase = "idle" | "checking" | "deliberating" | "complete";

type Incident = {
  id: string;
  file: File;
  url: string;
  caption: string;
  reviewCount: number;
  verdict?: Verdict;
};

const MAX_IMAGES = 6;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const cardMeanings: Record<VerdictKey, string> = {
  "no-foul": "GAME RECOGNIZES GAME",
  yellow: "SUSPICIOUS RIZZ",
  red: "ILLEGALLY OUTSIDE HIS LEAGUE",
};

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phase, setPhase] = useState<ReviewPhase>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const activeIncident = useMemo(
    () => incidents.find((incident) => incident.id === activeId) ?? incidents[0],
    [activeId, incidents],
  );

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      timers.current.forEach(clearTimeout);
    };
  }, []);

  function stopReviewTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function addFiles(files: FileList | File[]) {
    const availableSlots = MAX_IMAGES - incidents.length;
    if (availableSlots <= 0) {
      setError(`The replay booth can hold up to ${MAX_IMAGES} incidents.`);
      return;
    }

    const candidates = Array.from(files);
    const validFiles = candidates.filter(
      (file) => file.type.startsWith("image/") && file.size <= MAX_FILE_SIZE,
    );

    if (validFiles.length === 0) {
      setError("Choose a JPG, PNG, WEBP, or GIF under 10 MB.");
      return;
    }

    stopReviewTimers();
    const additions = validFiles.slice(0, availableSlots).map((file, index) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      return {
        id: `${file.name}-${file.lastModified}-${Date.now()}-${index}`,
        file,
        url,
        caption: "",
        reviewCount: 0,
      };
    });

    setIncidents((current) => [...current, ...additions]);
    setActiveId(additions[0].id);
    setPhase("idle");
    trackAnalyticsEvent("evidence_added", { image_count: additions.length });
    setError(
      validFiles.length < candidates.length
        ? "Some files were skipped because they were not supported images or exceeded 10 MB."
        : candidates.length > availableSlots
          ? `Only the first ${availableSlots} image${availableSlots === 1 ? "" : "s"} were added.`
          : "",
    );
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function updateCaption(event: ChangeEvent<HTMLTextAreaElement>) {
    if (!activeIncident) return;

    const caption = event.target.value.slice(0, MAX_CAPTION_LENGTH);
    stopReviewTimers();
    setIncidents((current) =>
      current.map((incident) =>
        incident.id === activeIncident.id ? { ...incident, caption, verdict: undefined } : incident,
      ),
    );
    setPhase("idle");
  }

  function reviewIncident() {
    if (!activeIncident || phase === "checking" || phase === "deliberating") return;

    stopReviewTimers();
    const incidentId = activeIncident.id;
    const caption = activeIncident.caption;
    const previousKey = activeIncident.verdict?.key;
    const nextReviewCount = activeIncident.reviewCount + 1;
    const randomValue = cryptoRandom();
    if (previousKey) {
      trackAnalyticsEvent("review_again", { previous_verdict: previousKey });
    }
    setPhase("checking");

    timers.current = [
      setTimeout(() => setPhase("deliberating"), 850),
      setTimeout(() => {
        const verdict = makeVerdict(caption, randomValue, previousKey);
        trackAnalyticsEvent("verdict_completed", {
          verdict: verdict.key,
          review_count: nextReviewCount,
        });
        setIncidents((current) =>
          current.map((incident) =>
            incident.id === incidentId
              ? { ...incident, verdict, reviewCount: incident.reviewCount + 1 }
              : incident,
          ),
        );
        setPhase("complete");
        timers.current = [];
      }, 2100),
    ];
  }

  function removeIncident(id: string) {
    const removed = incidents.find((incident) => incident.id === id);
    if (removed) {
      URL.revokeObjectURL(removed.url);
      objectUrls.current = objectUrls.current.filter((url) => url !== removed.url);
    }

    stopReviewTimers();
    const remaining = incidents.filter((incident) => incident.id !== id);
    setIncidents(remaining);
    setActiveId((current) => (current === id ? remaining[0]?.id ?? null : current));
    setPhase("idle");
    setError("");
  }

  function selectIncident(id: string) {
    stopReviewTimers();
    setActiveId(id);
    setPhase(incidents.find((incident) => incident.id === id)?.verdict ? "complete" : "idle");
    setError("");
  }

  const isReviewing = phase === "checking" || phase === "deliberating";
  const completedCount = incidents.filter((incident) => incident.verdict).length;
  const reviewStage = phase === "checking" ? "READING CASE NOTES" : "MEASURING RIZZ DIFFERENTIAL";

  return (
    <main>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Ref home">
          <span className="brand-mark">R!</span>
          <span>REF?</span>
        </a>
        <div className="live-pill"><span aria-hidden="true" /> MEME VAR ONLINE</div>
        <a className="how-link" href="#how-it-works">HOW IT WORKS <span aria-hidden="true">↘</span></a>
      </nav>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <h1 id="hero-title" className="visually-hidden">Ref, is this allowed?</h1>

        <figure className="hero-banner">
          <div className="hero-banner-frame">
            <Image
              src="/og-rizz.png"
              alt="Referee reviewing meme evidence at a VAR monitor while holding yellow and red cards."
              width={1536}
              height={1024}
              sizes="(max-width: 600px) calc(100vw - 24px), 92vw"
              preload
            />
          </div>
          <figcaption><span>OFFICIAL MEME REFEREE</span><span>VAR BOOTH / ONLINE</span></figcaption>
        </figure>

        <div className="hero-support">
          <div className="hero-support-copy">
            <p className="eyebrow"><span>01</span> FREE MEME REFEREE &amp; FUNNY VAR VERDICT TOOL</p>
            <p className="intro">
              Upload a photo, add context, and get a wildly overconfident no-foul, yellow-card, or red-card verdict—free, private, and ready for the group chat.
            </p>
          </div>
          <div className="hero-actions">
            <div className="legend" aria-label="Possible referee decisions">
              <span><i className="dot green" /> NO FOUL</span>
              <span><i className="dot yellow" /> YELLOW</span>
              <span><i className="dot red" /> RED</span>
            </div>
            <a className="hero-cta" href="#review-title">SUBMIT EVIDENCE <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </section>

      <section className="review-shell" aria-labelledby="review-title">
        <div className="review-heading">
          <div>
            <p className="section-number">02 / REVIEW BOOTH</p>
            <h2 id="review-title">Submit the evidence</h2>
          </div>
          <p className="privacy-note">Photos stay local in this browser.<br />Verdicts use caption cues plus randomness, not image analysis or AI analysis.</p>
        </div>

        <div className="review-grid">
          <div className="upload-column">
            {incidents.length === 0 ? (
              <div
                className={`dropzone ${isDragging ? "is-dragging" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="drop-icon" aria-hidden="true"><span>+</span></div>
                <p className="drop-kicker">SHOW US WHAT HAPPENED</p>
                <h3>Drop the footage here</h3>
                <p>or choose up to {MAX_IMAGES} images from your device</p>
                <p className="drop-context">Evidence may not contain people. A caption gives the referee context.</p>
                <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>
                  CHOOSE IMAGES <span aria-hidden="true">↗</span>
                </button>
                <small>JPG, PNG, WEBP OR GIF · MAX 10 MB EACH</small>
              </div>
            ) : (
              <div className="evidence-viewer">
                <div className="viewer-bar">
                  <span>CAM {String(incidents.findIndex((item) => item.id === activeIncident?.id) + 1).padStart(2, "0")}</span>
                  <span className="recording"><i /> LIVE REVIEW</span>
                  <span>{activeIncident?.file.name}</span>
                </div>
                <div className="image-stage">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are private browser previews and cannot use the Next.js image optimizer. */}
                  {activeIncident && <img src={activeIncident.url} alt={`Uploaded incident: ${activeIncident.file.name}`} />}
                  <span className="corner corner-tl" aria-hidden="true" />
                  <span className="corner corner-tr" aria-hidden="true" />
                  <span className="corner corner-bl" aria-hidden="true" />
                  <span className="corner corner-br" aria-hidden="true" />
                  {isReviewing && (
                    <div className="review-overlay" role="status" aria-live="polite">
                      <div className="scan-line" />
                      <span>{reviewStage}</span>
                    </div>
                  )}
                </div>
                <div className="filmstrip" aria-label="Uploaded incidents">
                  {incidents.map((incident, index) => (
                    <button
                      key={incident.id}
                      className={`thumbnail ${incident.id === activeIncident?.id ? "active" : ""}`}
                      onClick={() => selectIncident(incident.id)}
                      type="button"
                      aria-label={`Review incident ${index + 1}: ${incident.file.name}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are private browser previews and cannot use the Next.js image optimizer. */}
                      <img src={incident.url} alt="" />
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {incident.verdict && <i style={{ background: incident.verdict.color }} />}
                    </button>
                  ))}
                  {incidents.length < MAX_IMAGES && (
                    <button className="add-more" type="button" onClick={() => inputRef.current?.click()} aria-label="Add more images">+</button>
                  )}
                </div>

                {activeIncident && (
                  <div className="caption-panel">
                    <div className="caption-heading">
                      <div>
                        <p className="caption-kicker">CASE NOTES</p>
                        <label htmlFor="incident-caption">Give the referee context</label>
                      </div>
                      <span>OPTIONAL</span>
                    </div>
                    <textarea
                      id="incident-caption"
                      value={activeIncident.caption}
                      onChange={updateCaption}
                      maxLength={MAX_CAPTION_LENGTH}
                      rows={3}
                      placeholder="What should the ref know about this incident?"
                      aria-describedby="caption-help caption-count"
                    />
                    <div className="caption-footer">
                      <span id="caption-help">Evidence may not contain people; a caption gives context.</span>
                      <span id="caption-count" aria-live="polite">{activeIncident.caption.length}/{MAX_CAPTION_LENGTH}</span>
                    </div>
                  </div>
                )}

                <button className="remove-link" type="button" onClick={() => activeIncident && removeIncident(activeIncident.id)}>
                  REMOVE THIS INCIDENT
                </button>
              </div>
            )}

            <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple aria-label="Choose image files" onChange={handleInput} />
            {error && <p className="error-message" role="alert">{error}</p>}
          </div>

          <aside className={`decision-panel ${activeIncident?.verdict ? `verdict-${activeIncident.verdict.key}` : ""}`} aria-label="Referee decision">
            <div className="panel-topline">
              <span>OFFICIAL DECISION</span>
              <span>{completedCount}/{incidents.length || 1} REVIEWED</span>
            </div>

            {!activeIncident ? (
              <div className="empty-decision">
                <div className="ref-avatar" aria-hidden="true"><span>?</span></div>
                <p>THE REFEREE IS WAITING</p>
                <h3>No incident<br />on the monitor.</h3>
                <small>Upload evidence to wake the officials.</small>
              </div>
            ) : activeIncident.verdict && phase === "complete" ? (
              <div className="verdict-result" aria-live="assertive">
                <p className="whistle">FWEET!</p>
                <div className={`card card-${activeIncident.verdict.key}`} aria-hidden="true">
                  {activeIncident.verdict.key === "no-foul" ? <span>✓</span> : null}
                </div>
                <p className="verdict-kicker">AFTER CAREFUL REVIEW · CALL {String(activeIncident.reviewCount).padStart(2, "0")}</p>
                <h3>{activeIncident.verdict.label}</h3>
                <p className="verdict-short">{activeIncident.verdict.shortLabel}</p>
                <p className="card-meaning">{cardMeanings[activeIncident.verdict.key]}</p>
                <p className="ruling">{activeIncident.verdict.ruling}</p>
                <div className="var-notes" aria-label="Fictional VAR notes">
                  <p className="var-notes-title">FICTIONAL VAR NOTES</p>
                  <ul>
                    <li><span>VAR 01</span>{activeIncident.verdict.notes[0]}</li>
                    <li><span>VAR 02</span>{activeIncident.verdict.notes[1]}</li>
                  </ul>
                </div>
                <button className="review-button inverse" type="button" onClick={reviewIncident}>
                  REVIEW AGAIN <span aria-hidden="true">↻</span>
                </button>
              </div>
            ) : (
              <div className="ready-decision">
                <div className={`ref-avatar ${isReviewing ? "thinking" : ""}`} aria-hidden="true">
                  <span>{isReviewing ? "…" : "!"}</span>
                </div>
                <p>{isReviewing ? "CHECKING TRANSFER RECORDS" : "EVIDENCE RECEIVED"}</p>
                <h3>{isReviewing ? "Hold your outrage." : "Ready for the\nofficial call?"}</h3>
                <div className="status-track" aria-hidden="true">
                  <i className="done" /><b className={isReviewing ? "done" : ""} /><i className={phase === "deliberating" ? "done" : ""} />
                </div>
                <small>{isReviewing ? "Reading case notes, checking transfer records, and measuring the rizz differential." : "Add context if you want. One click. Three possible outcomes. Zero appeals."}</small>
                <button className="review-button" type="button" onClick={reviewIncident} disabled={isReviewing}>
                  {isReviewing ? "REVIEWING…" : "REVIEW THE INCIDENT"} <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <p className="section-number">03 / THE PROTOCOL</p>
        <div className="how-header">
          <h2>How the meme<br />referee <em>works.</em></h2>
          <p>A highly serious process for deeply unserious disputes.</p>
        </div>
        <div className="steps">
          <article><span>01</span><strong>SUBMIT</strong><p>Upload the screenshot, photo, fit check, bad take, or any evidence—even when no people are in frame.</p></article>
          <article><span>02</span><strong>REVIEW</strong><p>Read the case notes, check transfer records, and measure the rizz differential with theatrical intensity.</p></article>
          <article><span>03</span><strong>SETTLE IT</strong><p>Receive a no-foul, yellow-card, or straight-red ruling. The call stands.</p></article>
        </div>
      </section>

      <section className="uses-section" aria-labelledby="uses-title">
        <p className="section-number">04 / GROUP-CHAT JURISDICTION</p>
        <div className="uses-header">
          <h2 id="uses-title">Every questionable post<br /><em>deserves a verdict.</em></h2>
          <p>REF? is a free meme verdict generator for the evidence your group chat cannot settle on its own.</p>
        </div>
        <div className="use-cases">
          <article><h3>FIT CHECKS</h3><p>When the outfit is bold enough to require an official review.</p></article>
          <article><h3>FOOD CRIMES</h3><p>When dinner looks suspicious but the chef refuses to apologize.</p></article>
          <article><h3>HOT TAKES</h3><p>When a screenshot, sign, purchase, or opinion needs a fictional card.</p></article>
        </div>
        <div className="outcome-guide" aria-label="Meme referee verdict guide">
          <article><i className="dot green" /><h3>No foul</h3><p>Game recognizes game. Play on.</p></article>
          <article><i className="dot yellow" /><h3>Yellow card</h3><p>Suspicious behavior earns a caution.</p></article>
          <article><i className="dot red" /><h3>Red card</h3><p>The fictional call is immediate and final.</p></article>
        </div>
      </section>

      <section className="faq-section" aria-labelledby="faq-title">
        <div className="faq-heading">
          <p className="section-number">05 / QUESTIONS FROM THE TOUCHLINE</p>
          <h2 id="faq-title">Meme referee FAQ</h2>
        </div>
        <div className="faq-list">
          <details>
            <summary>What is REF?</summary>
            <p>REF? is a free browser-based meme referee. Add an image and optional caption, then receive a funny no-foul, yellow-card, or red-card verdict to share with your group chat.</p>
          </details>
          <details>
            <summary>Does REF? upload or analyze my photo?</summary>
            <p>No. Photos stay local in your browser and are never uploaded or inspected. Verdicts use caption cues plus randomness, not image analysis or AI analysis.</p>
          </details>
          <details>
            <summary>What do the three meme verdicts mean?</summary>
            <p>No foul means play on, yellow card means suspicious behavior, and red card means the fictional referee has seen enough. Every ruling is for entertainment only.</p>
          </details>
          <details>
            <summary>Which image files can I use?</summary>
            <p>You can choose up to six JPG, PNG, WEBP, or GIF images, with a maximum size of 10 MB each. A short caption is optional and gives the referee extra context.</p>
          </details>
        </div>
      </section>

      <footer>
        <div className="footer-brand">REF?</div>
        <p>BUILT FOR THE GROUP CHAT · NOT AFFILIATED WITH ACTUAL FOOTBALL · DECISIONS ARE FOR MEMES ONLY</p>
        <div className="footer-actions">
          <AnalyticsConsentControl />
          <a href="#top">BACK TO TOP ↑</a>
        </div>
      </footer>
    </main>
  );
}
