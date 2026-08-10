import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "REF? — The Internet's Meme Referee",
    description: "Submit the evidence, add the context, and let the meme referee rule on suspicious levels of game.",
    openGraph: {
      title: "REF, IS THIS ALLOWED?",
      description: "Drop the receipts. Put suspicious levels of rizz under review.",
      type: "website",
      images: [{ url: `${origin}/og-rizz.png`, width: 1536, height: 1024, alt: "REF? — rizz under review" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "REF, IS THIS ALLOWED?",
      description: "Drop the receipts. Put suspicious levels of rizz under review.",
      images: [`${origin}/og-rizz.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
