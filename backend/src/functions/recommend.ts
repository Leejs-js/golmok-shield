import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from "@azure/functions";
import { corsHeaders, isOriginAllowed } from "../http/cors";
import {
  getPublicQuestions,
  handleDongReport,
  handleHealth,
  handleRecommendation,
  handleScoreInsight,
  type JsonResult,
} from "../http/handlers";

function response(
  request: HttpRequest,
  result: JsonResult,
): HttpResponseInit {
  return {
    status: result.status,
    jsonBody: result.body,
    headers: corsHeaders(request.headers.get("origin")),
  };
}

function preflightOrRejected(request: HttpRequest): HttpResponseInit | undefined {
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    return response(request, {
      status: 403,
      body: { error: "허용되지 않은 요청 출처입니다." },
    });
  }
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders(origin),
    };
  }
  return undefined;
}

async function recommend(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const earlyResponse = preflightOrRejected(request);
  if (earlyResponse) return earlyResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response(request, {
      status: 400,
      body: { error: "요청 본문은 유효한 JSON이어야 합니다." },
    });
  }
  return response(request, await handleRecommendation(body));
}

async function scoreInsight(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const earlyResponse = preflightOrRejected(request);
  if (earlyResponse) return earlyResponse;
  try {
    return response(request, await handleScoreInsight(await request.json()));
  } catch {
    return response(request, { status: 400, body: { error: "요청 본문은 유효한 JSON이어야 합니다." } });
  }
}

async function dongReport(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const earlyResponse = preflightOrRejected(request);
  if (earlyResponse) return earlyResponse;
  try {
    return response(request, await handleDongReport(await request.json()));
  } catch {
    return response(request, { status: 400, body: { error: "요청 본문은 유효한 JSON이어야 합니다." } });
  }
}

async function questions(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const earlyResponse = preflightOrRejected(request);
  return earlyResponse ?? response(request, { status: 200, body: getPublicQuestions() });
}

async function health(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const earlyResponse = preflightOrRejected(request);
  return earlyResponse ?? response(request, handleHealth());
}

app.http("recommend", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "recommend",
  handler: recommend,
});

app.http("recommend-questions", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "recommend/questions",
  handler: questions,
});

app.http("recommend-score-insight", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "recommend/score-insight",
  handler: scoreInsight,
});

app.http("recommend-dong-report", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "recommend/dong-report",
  handler: dongReport,
});

app.http("recommend-health", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "recommend/health",
  handler: health,
});
