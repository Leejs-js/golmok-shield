import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { PAYLOAD_TOO_LARGE, routeRequest, type RouterResponse } from "./http/router";
import { loadLocalEnvironment } from "./loadLocalEnvironment";

loadLocalEnvironment();
const port = Number(process.env.PORT || 7071);
const maxBodyBytes = 1024 * 1024;

function send(response: ServerResponse, result: RouterResponse): void {
  response.writeHead(result.status, result.headers);
  response.end(result.body === undefined ? undefined : JSON.stringify(result.body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBodyBytes) throw new Error(PAYLOAD_TOO_LARGE);
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  send(
    response,
    await routeRequest({
      method: request.method || "GET",
      pathname: url.pathname,
      origin: typeof request.headers.origin === "string" ? request.headers.origin : null,
      readJson: () => readJson(request),
    }),
  );
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[backend] http://127.0.0.1:${port}`);
});
