import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import test from "node:test";
import {
  buildAzureUrl,
  getClientConfig,
  handleChat,
  parseEnv,
} from "../server.js";

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.chunks = [];
    this.destroyed = false;
    this.headersSent = false;
    this.writableEnded = false;
  }

  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;
    this.headersSent = true;
  }

  flushHeaders() {}

  write(chunk) {
    this.chunks.push(Buffer.from(chunk));
  }

  end(chunk) {
    if (chunk) this.write(chunk);
    this.writableEnded = true;
  }

  text() {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

function createJsonRequest(payload) {
  return Readable.from([Buffer.from(JSON.stringify(payload))]);
}

test("parseEnv handles comments, spaces, and quotes", () => {
  assert.deepEqual(
    parseEnv(`
      # comment
      A=one
      B = "two words"
      C='three'
    `),
    { A: "one", B: "two words", C: "three" },
  );
});

test("buildAzureUrl creates the current v1 responses URL", () => {
  assert.equal(
    buildAzureUrl("https://demo.openai.azure.com/"),
    "https://demo.openai.azure.com/openai/v1/responses",
  );
  assert.throws(() => buildAzureUrl("http://demo.example.com"), /https/);
});

test("client config never exposes the API key", () => {
  const config = {
    endpoint: "https://demo.openai.azure.com",
    apiKey: "super-secret",
    deployment: "gpt-deployment",
  };
  const result = getClientConfig(config);

  assert.equal(JSON.stringify(result).includes("super-secret"), false);
  assert.deepEqual(result, {
    configured: true,
    deployment: "gpt-deployment",
  });
});

test("chat endpoint validates input", async () => {
  const config = {
    endpoint: "https://demo.openai.azure.com",
    apiKey: "key",
    deployment: "deployment",
  };
  const request = createJsonRequest({ messages: [] });
  const response = new MockResponse();
  await handleChat(request, response, config);

  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.text()).error, /1개 이상/);
});

test("chat endpoint proxies Azure SSE without leaking credentials", async () => {
  let capturedUrl;
  let capturedOptions;
  const mockFetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return new Response('data: {"type":"response.output_text.delta","delta":"hello"}\n\ndata: [DONE]\n\n', {
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  const config = {
    endpoint: "https://demo.openai.azure.com",
    apiKey: "secret-key",
    deployment: "coding-model",
  };
  const request = createJsonRequest({
    systemPrompt: "Be precise",
    messages: [{ role: "user", content: "hello" }],
  });
  const response = new MockResponse();
  await handleChat(request, response, config, mockFetch);

  assert.equal(response.statusCode, 200);
  assert.equal(capturedUrl, "https://demo.openai.azure.com/openai/v1/responses");
  assert.equal(capturedOptions.headers["api-key"], "secret-key");
  assert.deepEqual(JSON.parse(capturedOptions.body), {
    model: "coding-model",
    instructions: "Be precise",
    input: [{ role: "user", content: "hello" }],
    stream: true,
  });
  assert.match(response.text(), /hello/);
});
