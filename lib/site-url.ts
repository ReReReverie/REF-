type SiteEnvironment = {
  [key: string]: string | undefined;
  SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
  VERCEL_ENV?: string;
};

const LOCAL_SITE_URL = new URL("http://localhost:3000");

function absoluteHttpUrl(value: string | undefined): URL | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/iu.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function getSiteUrl(environment: SiteEnvironment = process.env): URL {
  const configuredUrl =
    absoluteHttpUrl(environment.SITE_URL) ??
    absoluteHttpUrl(environment.VERCEL_PROJECT_PRODUCTION_URL) ??
    absoluteHttpUrl(environment.VERCEL_URL);

  if (configuredUrl) return configuredUrl;
  if (environment.VERCEL_ENV === "production" || environment.VERCEL_ENV === "preview") {
    throw new Error("Set SITE_URL or a Vercel deployment URL for non-local builds.");
  }

  return new URL(LOCAL_SITE_URL);
}

export function isIndexableDeployment(
  vercelEnvironment = process.env.VERCEL_ENV,
): boolean {
  return vercelEnvironment === "production";
}
