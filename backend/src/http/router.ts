import { corsHeaders, isOriginAllowed } from "./cors";
import {
  getPublicQuestions,
  handleDongReport,
  handleHealth,
  handleRecommendation,
  handleScoreInsight,
  type JsonResult,
} from "./handlers";

export type RouterRequest = {
  method: string;
  pathname: string;
  origin: string | null;
  readJson: () => Promise<unknown>;
};

export type RouterResponse = {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
};

export const PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE";

type PostRoute = {
  handle: (body: unknown) => Promise<JsonResult>;
  invalidBodyMessage: string;
};

const POST_ROUTES: Record<string, PostRoute> = {
  "/api/recommend": {
    handle: handleRecommendation,
    invalidBodyMessage: "요청 본문은 유효한 JSON이어야 합니다.",
  },
  "/api/recommend/score-insight": {
    handle: handleScoreInsight,
    invalidBodyMessage: "점수 설명 요청 본문이 올바르지 않습니다.",
  },
  "/api/recommend/dong-report": {
    handle: handleDongReport,
    invalidBodyMessage: "상권 리포트 요청 본문이 올바르지 않습니다.",
  },
};

/**
 * 로컬 devServer와 Vercel 함수가 함께 쓰는 런타임 독립 라우터.
 */
export async function routeRequest(request: RouterRequest): Promise<RouterResponse> {
  const { method, origin } = request;
  const pathname = request.pathname.replace(/\/+$/, "") || "/";
  const respond = (result: JsonResult): RouterResponse => ({
    status: result.status,
    headers: corsHeaders(origin),
    body: result.body,
  });

  if (!isOriginAllowed(origin)) {
    return respond({ status: 403, body: { error: "허용되지 않은 요청 출처입니다." } });
  }
  if (method === "OPTIONS") {
    return { status: 204, headers: corsHeaders(origin) };
  }

  if (method === "GET" && pathname === "/api/recommend/questions") {
    return respond({ status: 200, body: getPublicQuestions() });
  }
  if (method === "GET" && pathname === "/api/recommend/health") {
    return respond(handleHealth());
  }

  const postRoute = method === "POST" ? POST_ROUTES[pathname] : undefined;
  if (postRoute) {
    let body: unknown;
    try {
      body = await request.readJson();
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === PAYLOAD_TOO_LARGE;
      return respond({
        status: tooLarge ? 413 : 400,
        body: { error: tooLarge ? "요청 본문이 너무 큽니다." : postRoute.invalidBodyMessage },
      });
    }
    return respond(await postRoute.handle(body));
  }

  return respond({ status: 404, body: { error: "API 경로를 찾을 수 없습니다." } });
}
