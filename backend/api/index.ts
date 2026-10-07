// Vercel Serverless Function 진입점. /api/* 요청은 vercel.json rewrite로 모두 이 함수에 모인다.
export { default } from "../src/vercelHandler";
