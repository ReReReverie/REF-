"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type VerdictKey = "no-foul" | "yellow" | "red";
type ReviewPhase = "idle" | "checking" | "deliberating" | "complete";

type Verdict = {
  key: VerdictKey;
  label: string;
  shortLabel: string;
  ruling: string;
  color: string;
};

type Incident = {
  id: string;
  file: File;
  url: string;
  verdict?: Verdict;
};

const MAX_IMAGES = 6;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const verdicts: Record<VerdictKey, Omit<Verdict, "ruling"> & { rulings: string[] }> = {
  "no-foul": {
    key: "no-foul",
    label: "NO FOUL",
    shortLabel: "Play on",
    color: "#23d68a",
    rulings: [
      "After review, there is simply not enough drama. Play on.",
      "Clean challenge. The referee has seen far worse in the group chat.",
      "No offense detected. The internet may continue as normal.",
    ],
  },
  yellow: {
    key: "yellow",
    label: "YELLOW CARD",
    shortLabel: "Caution",
    color: "#f7df32",
    rulings: [
      "Reckless levels of audacity. A warning has been issued.",
      "Questionable behavior, but not quite a sending-off offense.",
      "The vibes are suspicious. Proceed carefully from here.",
    ],
  },
  red: {
    key: "red",
    label: "RED CARD",
    shortLabel: "Sent off",
    color: "#ff4e45",
    rulings: [
      "Unacceptable scenes. Straight red — no appeal, no notes.",
      "A serious meme offense. Please leave the timeline immediately.",
      "The replay somehow made it worse. Off you go.",
    ],
  },
};

function makeVerdict(file: File): Verdict {
  const source = `${file.name}-${file.size}-${file.lastModified}`;
  let score = 0;
  for (let index = 0; index < source.length; index += 1) {
    score = (score * 31 + source.charCodeAt(index)) >>> 0;
  }

  const key: VerdictKey = score % 10 < 5 ? "no-foul" : score % 10 < 8 ? "yellow" : "red";
  const template = verdicts[key];
  return {
    key,
    label: template.label,
    shortLabel: template.shortLabel,
    color: template.color,
    ruling: template.rulings[score % template.rulings.length],
  };
}

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

    const additions = validFiles.slice(0, availableSlots).map((file, index) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      return {
        id: `${file.name}-${file.lastModified}-${Date.now()}-${index}`,
        file,
        url,
      };
    });

    setIncidents((current) => [...current, ...additions]);
    setActiveId(additions[0].id);
    setPhase("idle");
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

  function reviewIncident() {
    if (!activeIncident || phase === "checking" || phase === "deliberating") return;
    timers.current.forEach(clearTimeout);
    setPhase("checking");

    timers.current = [
      setTimeout(() => setPhase("deliberating"), 850),
      setTimeout(() => {
        const verdict = makeVerdict(activeIncident.file);
        setIncidents((current) =>
          current.map((incident) =>
            incident.id === activeIncident.id ? { ...incident, verdict } : incident,
          ),
        );
        setPhase("complete");
      }, 2100),
    ];
  }

  function removeIncident(id: string) {
    const removed = incidents.find((incident) => incident.id === id);
    if (removed) {
      URL.revokeObjectURL(removed.url);
      objectUrls.current = objectUrls.current.filter((url) => url !== removed.url);
    }

    const remaining = incidents.filter((incident) => incident.id !== id);
    setIncidents(remaining);
    setActiveId((current) => (current === id ? remaining[0]?.id ?? null : current));
    setPhase("idle");
    setError("");
  }

  function selectIncident(id: string) {
    setActiveId(id);
    setPhase(incidents.find((incident) => incident.id === id)?.verdict ? "complete" : "idle");
    setError("");
  }

  const isReviewing = phase === "checking" || phase === "deliberating";
  const completedCount = incidents.filter((incident) => incident.verdict).length;

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

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span>01</span> YOUR INTERNET REFEREE</p>
          <h1>REF, IS THIS<br /><em>ALLOWED?</em></h1>
          <p className="intro">
            Drop the evidence. Our wildly overconfident meme referee will review the incident and make the only call that matters.
          </p>
          <div className="legend" aria-label="Possible referee decisions">
            <span><i className="dot green" /> NO FOUL</span>
            <span><i className="dot yellow" /> YELLOW</span>
            <span><i className="dot red" /> RED</span>
          </div>
        </div>

        <div className="referee-stamp" aria-hidden="true">
          <span>OFFICIAL</span>
          <strong>VAR</strong>
          <small>VERY ACCURATE REFEREE</small>
        </div>
      </section>

      <section className="review-shell" aria-labelledby="review-title">
        <div className="review-heading">
          <div>
            <p className="section-number">02 / REVIEW BOOTH</p>
            <h2 id="review-title">Submit the evidence</h2>
          </div>
          <p className="privacy-note">Your images stay in this browser.<br />No locker-room leaks.</p>
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
                  {activeIncident && <img src={activeIncident.url} alt={`Uploaded incident: ${activeIncident.file.name}`} />}
                  <span className="corner corner-tl" aria-hidden="true" />
                  <span className="corner corner-tr" aria-hidden="true" />
                  <span className="corner corner-bl" aria-hidden="true" />
                  <span className="corner corner-br" aria-hidden="true" />
                  {isReviewing && (
                    <div className="review-overlay" role="status" aria-live="polite">
                      <div className="scan-line" />
                      <span>{phase === "checking" ? "CHECKING ALL ANGLES" : "REFEREE DELIBERATING"}</span>
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
                      <img src={incident.url} alt="" />
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {incident.verdict && <i style={{ background: incident.verdict.color }} />}
                    </button>
                  ))}
                  {incidents.length < MAX_IMAGES && (
                    <button className="add-more" type="button" onClick={() => inputRef.current?.click()} aria-label="Add more images">+</button>
                  )}
                </div>
                <button className="remove-link" type="button" onClick={() => activeIncident && removeIncident(activeIncident.id)}>
                  REMOVE THIS INCIDENT
                </button>
              </div>
            )}

            <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={handleInput} />
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
                <p className="verdict-kicker">AFTER CAREFUL REVIEW</p>
                <h3>{activeIncident.verdict.label}</h3>
                <p className="ruling">{activeIncident.verdict.ruling}</p>
                <button className="review-button inverse" type="button" onClick={reviewIncident}>
                  REVIEW AGAIN <span aria-hidden="true">↻</span>
                </button>
              </div>
            ) : (
              <div className="ready-decision">
                <div className={`ref-avatar ${isReviewing ? "thinking" : ""}`} aria-hidden="true">
                  <span>{isReviewing ? "…" : "!"}</span>
                </div>
                <p>{isReviewing ? "VAR CHECK IN PROGRESS" : "EVIDENCE RECEIVED"}</p>
                <h3>{isReviewing ? "Hold your outrage." : "Ready for the\nofficial call?"}</h3>
                <div className="status-track" aria-hidden="true">
                  <i className="done" /><b className={isReviewing ? "done" : ""} /><i className={phase === "deliberating" ? "done" : ""} />
                </div>
                <small>{isReviewing ? "Enhancing pixels. Consulting absolutely nobody." : "One click. Three possible outcomes. Zero appeals."}</small>
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
          <h2>Three steps.<br /><em>One ruling.</em></h2>
          <p>A highly serious process for deeply unserious disputes.</p>
        </div>
        <div className="steps">
          <article><span>01</span><strong>SUBMIT</strong><p>Upload the screenshot, photo, fit check, bad take, or questionable evidence.</p></article>
          <article><span>02</span><strong>REVIEW</strong><p>Our meme VAR studies every pixel with theatrical and unnecessary intensity.</p></article>
          <article><span>03</span><strong>SETTLE IT</strong><p>Receive a no-foul, yellow-card, or straight-red ruling. The call stands.</p></article>
        </div>
      </section>

      <footer>
        <div className="footer-brand">REF?</div>
        <p>BUILT FOR THE GROUP CHAT · NOT AFFILIATED WITH ACTUAL FOOTBALL · DECISIONS ARE FOR MEMES ONLY</p>
        <a href="#top">BACK TO TOP ↑</a>
      </footer>
    </main>
  );
}
