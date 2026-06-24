const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://mango-bay-08358bc00.7.azurestaticapps.net",
];

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, "");
}

export function getAllowedOrigins(): Set<string> {
  const configured = process.env.CORS_ALLOWED_ORIGINS
    ?.split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  return new Set([...DEFAULT_ORIGINS, ...(configured ?? [])]);
}

function isAzureStaticWebAppOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.port === "" && url.hostname.endsWith(".azurestaticapps.net");
  } catch {
    return false;
  }
}

export function isOriginAllowed(origin: string | null): boolean {
  // 서버-서버 요청, curl, health check처럼 Origin 헤더가 없는 요청은 허용한다.
  if (origin === null) return true;

  const normalized = normalizeOrigin(origin);
  return getAllowedOrigins().has(normalized) || isAzureStaticWebAppOrigin(normalized);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };

  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = normalizeOrigin(origin);
  }

  return headers;
}
