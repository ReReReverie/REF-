"use client";

import Script from "next/script";
import { useState, useSyncExternalStore } from "react";
import {
  ANALYTICS_CONSENT_KEY,
  type AnalyticsConsent,
  getAnalyticsMeasurementId,
  readBrowserAnalyticsConsent,
  shouldLoadAnalytics,
  writeBrowserAnalyticsConsent,
} from "@/lib/analytics";

const CONSENT_CHANGE_EVENT = "ref:analytics-consent-change";

const measurementId = getAnalyticsMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

function subscribeToConsentChanges(onChange: () => void): () => void {
  if (!measurementId || typeof window === "undefined") return () => {};

  window.addEventListener("storage", onChange);
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  };
}

function subscribeToBrowserReady(): () => void {
  return () => {};
}

function getServerConsent(): AnalyticsConsent | null {
  return null;
}

function getBrowserConsent(): AnalyticsConsent | null {
  return measurementId ? readBrowserAnalyticsConsent() : null;
}

function getBrowserReady(): boolean {
  return measurementId !== null;
}

function getServerBrowserReady(): boolean {
  return false;
}

export default function AnalyticsConsentControl() {
  const choice = useSyncExternalStore(
    subscribeToConsentChanges,
    getBrowserConsent,
    getServerConsent,
  );
  const isReady = useSyncExternalStore(
    subscribeToBrowserReady,
    getBrowserReady,
    getServerBrowserReady,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isOpen = isSettingsOpen || (isReady && choice === null);

  if (!measurementId || !isReady) return null;

  function choose(nextChoice: AnalyticsConsent) {
    writeBrowserAnalyticsConsent(nextChoice);
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: nextChoice === "accepted" ? "granted" : "denied",
      });
    }
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
    setIsSettingsOpen(false);
  }

  return (
    <>
      {shouldLoadAnalytics(measurementId, choice) && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ref-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('consent','default',{analytics_storage:'denied'});gtag('js',new Date());if(window.localStorage.getItem('${ANALYTICS_CONSENT_KEY}')==='accepted'){gtag('consent','update',{analytics_storage:'granted'});gtag('config','${measurementId}',{anonymize_ip:true});}`}
          </Script>
        </>
      )}

      <button className="privacy-settings" type="button" onClick={() => setIsSettingsOpen(true)}>
        PRIVACY SETTINGS
      </button>

      {isOpen && (
        <section className="consent-banner" aria-labelledby="analytics-consent-title">
          <div>
            <p className="consent-kicker">YOUR CALL</p>
            <h2 id="analytics-consent-title">Help us improve the referee?</h2>
            <p>
              Optional analytics tell us whether visitors add evidence and finish a verdict.
              We never send your images, filenames, or captions.
            </p>
          </div>
          <div className="consent-actions">
            <button type="button" onClick={() => choose("accepted")}>ACCEPT ANALYTICS</button>
            <button type="button" onClick={() => choose("declined")}>DECLINE</button>
          </div>
        </section>
      )}
    </>
  );
}
