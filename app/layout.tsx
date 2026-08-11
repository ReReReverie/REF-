import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSiteUrl, isIndexableDeployment } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const SITE_TITLE = "Meme Referee – Get a Funny VAR Verdict | REF?";
export const SITE_DESCRIPTION =
  "Upload a photo, add context, and let REF? settle the group chat with a funny no-foul, yellow-card, or red-card meme verdict. Free and private.";

const siteUrl = getSiteUrl();
const canonicalUrl = siteUrl.toString();
const isIndexable = isIndexableDeployment();
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "REF?",
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: canonicalUrl },
  keywords: [
    "meme referee",
    "funny meme verdict",
    "VAR meme",
    "group chat game",
    "rizz referee",
  ],
  creator: "REF?",
  robots: isIndexable
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
  verification: googleVerification ? { google: googleVerification } : undefined,
  openGraph: {
    type: "website",
    url: canonicalUrl,
    siteName: "REF?",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "REF? meme referee with no-foul, yellow-card, and red-card verdicts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#10100f",
  colorScheme: "light",
};

const applicationStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "REF?",
  url: canonicalUrl,
  description: SITE_DESCRIPTION,
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern browser with JavaScript enabled.",
  isAccessibleForFree: true,
  image: new URL("/og.png", siteUrl).toString(),
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(applicationStructuredData).replace(/</gu, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
