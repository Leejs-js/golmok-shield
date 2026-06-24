import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { corsHeaders, isOriginAllowed } from "./http/cors";
import {
  getPublicQuestions,
  handleDongReport,
  handleHealth,
  handleRecommendation,
  handleScoreInsight,
  type JsonResult,
} from "./http/handlers";
import { loadLocalEnvironment } from "./loadLocalEnvironment";

loadLocalEnvironment();
const port = Number(process.env.PORT || 7071);
const maxBodyBytes = 1024 * 1024;

function send(
  response: ServerResponse,
  origin: string | null,
  result: JsonResult,
): void {
  response.writeHead(result.status, corsHeaders(origin));
  response.end(JSON.stringify(result.body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBodyBytes) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : null;
  if (!isOriginAllowed(origin)) {
    send(response, origin, { status: 403, body: { error: "허용되지 않은 요청 출처입니다." } });
    return;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/api/recommend/questions") {
    send(response, origin, { status: 200, body: getPublicQuestions() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/recommend/health") {
    send(response, origin, handleHealth());
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/recommend") {
    try {
      send(response, origin, await handleRecommendation(await readJson(request)));
    } catch (error) {
      send(response, origin, {
        status: error instanceof Error && error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400,
        body: {
          error:
            error instanceof Error && error.message === "PAYLOAD_TOO_LARGE"
              ? "요청 본문이 너무 큽니다."
              : "요청 본문은 유효한 JSON이어야 합니다.",
        },
      });
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/recommend/score-insight") {
    try {
      send(response, origin, await handleScoreInsight(await readJson(request)));
    } catch (error) {
      send(response, origin, {
        status: error instanceof Error && error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400,
        body: { error: "점수 설명 요청 본문이 올바르지 않습니다." },
      });
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/recommend/dong-report") {
    try {
      send(response, origin, await handleDongReport(await readJson(request)));
    } catch (error) {
      send(response, origin, {
        status: error instanceof Error && error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400,
        body: { error: "상권 리포트 요청 본문이 올바르지 않습니다." },
      });
    }
    return;
  }
  send(response, origin, { status: 404, body: { error: "API 경로를 찾을 수 없습니다." } });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[backend] http://127.0.0.1:${port}`);
});
