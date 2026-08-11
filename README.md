# REF?

REF? is a free, browser-based meme referee. Upload a photo, add optional
context, and get a funny no-foul, yellow-card, or red-card verdict for the
group chat.

Photos stay in the browser. REF? does not upload images, inspect image pixels,
or use image analysis. Verdicts use secure randomness plus limited caption
cues, and are for entertainment only.

## Prerequisites

- Node.js `>=22.13.0`
- npm

## Local Development

Install dependencies and start the Next.js development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For optional local
configuration, copy `.env.example` to `.env.local` and set the values you
need. Restart the development server after changing environment variables.

Useful checks:

```bash
npm run build
npm start
npm run lint
npm run typecheck
npm test
```

`npm test` builds and serves the native Next.js application in development,
preview, and production deployment modes. It runs HTTP checks for the homepage,
`/robots.txt`, and `/sitemap.xml` in each mode, plus the verdict and
analytics-consent tests. The application has no required external service for
local use.

## Environment Variables

All variables are optional. The app remains fully usable when they are empty.

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Permanent custom-domain origin for canonical metadata, the sitemap, and structured data. Use an absolute `https://` URL. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional GA4 measurement ID such as `G-XXXXXXXXXX`. GA4 loads only after analytics consent is accepted. |
| `GOOGLE_SITE_VERIFICATION` | Optional token from Google Search Console's HTML-tag verification method. |

On Vercel, canonical URLs use `SITE_URL` first, then Vercel's stable
production URL, and finally `http://localhost:3000` during local development.
Only production deployments are indexable; development and preview
deployments send `noindex` metadata and disallow crawling.

## Vercel Deployment

1. Import the repository into Vercel and keep the detected Next.js framework
   settings. The standard build command is `npm run build`.
2. Add the needed variables in the Vercel project settings. Set `SITE_URL`
   only when the permanent custom domain is available; use the exact origin,
   without a path. Add the GA4 and Search Console values for the Production
   environment.
3. Deploy, then check the homepage and these public endpoints:
   `/robots.txt` and `/sitemap.xml`.
4. If you set or change `SITE_URL`, redeploy so canonical URLs, Open Graph
   URLs, the sitemap, and structured data update together.

Vercel's stable production URL is used automatically when `SITE_URL` is not
set. Preview deployments remain non-indexable so they do not compete with the
production URL in search results.

## After Deployment

### Google Search Console

1. Add the production URL as a URL-prefix property in [Google Search
   Console](https://search.google.com/search-console).
2. Put the supplied HTML-tag token in `GOOGLE_SITE_VERIFICATION`, deploy, and
   complete verification.
3. Submit `https://your-production-origin.example/sitemap.xml` in Search
   Console and confirm that `/robots.txt` references the same sitemap.

### GA4

1. Create a GA4 web data stream and put its measurement ID in
   `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
2. Deploy, accept analytics on the production site, and confirm the visit in
   the GA4 Realtime report.
3. In GA4, link the property to Search Console through the Search Console
   product link. Monitor impressions, click-through rate, organic sessions,
   and completed verdicts.

The only events sent are `evidence_added`, `verdict_completed`, and
`review_again`. Their payloads contain counts and verdict labels only; they do
not include filenames, captions, images, or object URLs.
