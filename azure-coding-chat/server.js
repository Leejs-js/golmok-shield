import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(ROOT_DIR, "public");
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGES = 100;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

export function parseEnv(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

export async function loadConfig(env = process.env) {
  let fileEnv = {};
  const envPath = join(ROOT_DIR, ".env");

  if (existsSync(envPath)) {
    fileEnv = parseEnv(await readFile(envPath, "utf8"));
  }

  const get = (name, fallback = "") => env[name] || fileEnv[name] || fallback;
  const endpoint = get("AZURE_OPENAI_ENDPOINT").replace(/\/+$/, "");
  const apiKey = get("AZURE_OPENAI_API_KEY");
  const deployment = get("AZURE_OPENAI_DEPLOYMENT");
  const parsedPort = Number.parseInt(get("PORT", "3000"), 10);

  return {
    endpoint,
    apiKey,
    deployment,
    port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000,
  };
}

export function buildAzureUrl(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("AZURE_OPENAI_ENDPOINT가 올바른 URL이 아닙니다.");
  }

  if (url.protocol !== "https:") {
    throw new Error("AZURE_OPENAI_ENDPOINT는 https:// URL이어야 합니다.");
  }

  url.pathname = `${url.pathname.replace(/\/+$/, "")}/openai/v1/responses`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("요청이 너무 큽니다.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("요청 JSON 형식이 올바르지 않습니다.");
    error.statusCode = 400;
    throw error;
  }
}

function validateChatRequest(payload) {
  if (!payload || !Array.isArray(payload.messages)) {
    throw new Error("messages 배열이 필요합니다.");
  }
  if (payload.messages.length === 0 || payload.messages.length > MAX_MESSAGES) {
    throw new Error(`메시지는 1개 이상 ${MAX_MESSAGES}개 이하여야 합니다.`);
  }

  const messages = payload.messages.map((message) => {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      throw new Error("각 메시지에는 유효한 role과 content가 필요합니다.");
    }

    if (message.content.length > 100_000) {
      throw new Error("개별 메시지가 너무 깁니다.");
    }

    return { role: message.role, content: message.content };
  });

  const systemPrompt =
    typeof payload.systemPrompt === "string" ? payload.systemPrompt.trim() : "";
  if (systemPrompt.length > 20_000) {
    throw new Error("시스템 프롬프트가 너무 깁니다.");
  }

  return { messages, systemPrompt };
}

async function getAzureError(upstream) {
  const raw = await upstream.text();
  try {
    const parsed = JSON.parse(raw);
    return parsed.error?.message || parsed.message || raw;
  } catch {
    return raw || `Azure OpenAI 요청 실패 (${upstream.status})`;
  }
}

export function getClientConfig(config) {
  return {
    configured: Boolean(config.endpoint && config.apiKey && config.deployment),
    deployment: config.deployment || null,
  };
}

export async function handleChat(request, response, config, fetchImpl = fetch) {
  const missing = [
    ["AZURE_OPENAI_ENDPOINT", config.endpoint],
    ["AZURE_OPENAI_API_KEY", config.apiKey],
    ["AZURE_OPENAI_DEPLOYMENT", config.deployment],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    sendJson(response, 503, {
      error: `.env에 다음 설정이 필요합니다: ${missing.join(", ")}`,
    });
    return;
  }

  let chat;
  try {
    chat = validateChatRequest(await readJsonBody(request));
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message });
    return;
  }

  const controller = new AbortController();
  response.on("close", () => {
    if (!response.writableEnded) controller.abort();
  });

  let upstream;
  try {
    upstream = await fetchImpl(buildAzureUrl(config.endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
      },
      body: JSON.stringify({
        model: config.deployment,
        instructions: chat.systemPrompt || undefined,
        input: chat.messages,
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") return;
    sendJson(response, 502, {
      error: `Azure OpenAI에 연결할 수 없습니다: ${error.message}`,
    });
    return;
  }

  if (!upstream.ok) {
    const message = await getAzureError(upstream);
    sendJson(response, upstream.status, { error: message });
    return;
  }

  if (!upstream.body) {
    sendJson(response, 502, { error: "Azure OpenAI 응답 본문이 없습니다." });
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      response.write(value);
    }
  } catch (error) {
    if (error.name !== "AbortError" && !response.destroyed) {
      response.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  } finally {
    if (!response.destroyed) response.end();
  }
}

async function serveStatic(requestPath, response) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const requestedFile = resolve(PUBLIC_DIR, relativePath);
  const publicRoot = resolve(PUBLIC_DIR) + sep;

  if (!requestedFile.startsWith(publicRoot)) {
    sendJson(response, 403, { error: "허용되지 않은 경로입니다." });
    return;
  }

  try {
    const file = await readFile(requestedFile);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(requestedFile)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Content-Security-Policy":
        "default-src 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: "페이지를 찾을 수 없습니다." });
      return;
    }
    throw error;
  }
}

export function createServer(config, { fetchImpl = fetch } = {}) {
  return createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

      if (request.method === "GET" && url.pathname === "/api/config") {
        sendJson(response, 200, getClientConfig(config));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/chat") {
        await handleChat(request, response, config, fetchImpl);
        return;
      }

      if (request.method === "GET" || request.method === "HEAD") {
        await serveStatic(decodeURIComponent(url.pathname), response);
        return;
      }

      sendJson(response, 405, { error: "지원하지 않는 요청 방식입니다." });
    } catch (error) {
      console.error(error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "서버 내부 오류가 발생했습니다." });
      } else if (!response.destroyed) {
        response.end();
      }
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const config = await loadConfig();
  const server = createServer(config);

  server.listen(config.port, "127.0.0.1", () => {
    console.log(`\nAzure Coding Chat: http://localhost:${config.port}`);
    if (!config.endpoint || !config.apiKey || !config.deployment) {
      console.log("설정이 필요합니다. .env.example을 복사해 .env를 작성하세요.\n");
    } else {
      console.log(`Azure deployment: ${config.deployment}\n`);
    }
  });
}
