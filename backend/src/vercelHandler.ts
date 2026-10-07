import type { IncomingMessage, ServerResponse } from "node:http";
import { PAYLOAD_TOO_LARGE, routeRequest } from "./http/router";

const maxBodyBytes = 1024 * 1024;

// Vercel Node 런타임은 req.body를 미리 파싱해 줄 수 있으므로 이를 우선 사용한다.
type VercelRequest = IncomingMessage & { body?: unknown };

async function readJson(request: VercelRequest): Promise<unknown> {
  const parsed = request.body;
  if (parsed !== undefined && !Buffer.isBuffer(parsed) && typeof parsed !== "string") {
    return parsed;
  }

  const raw = parsed ?? (await readRawBody(request));
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
  if (Buffer.byteLength(text) > maxBodyBytes) throw new Error(PAYLOAD_TOO_LARGE);
  return JSON.parse(text);
}

async function readRawBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBodyBytes) throw new Error(PAYLOAD_TOO_LARGE);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(request: VercelRequest, response: ServerResponse): Promise<void> {
  const url = new URL(request.url || "/", "http://localhost");
  const result = await routeRequest({
    method: request.method || "GET",
    pathname: url.pathname,
    origin: typeof request.headers.origin === "string" ? request.headers.origin : null,
    readJson: () => readJson(request),
  });

  response.writeHead(result.status, result.headers);
  response.end(result.body === undefined ? undefined : JSON.stringify(result.body));
}
