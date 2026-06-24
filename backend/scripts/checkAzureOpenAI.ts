import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAzureOpenAIStatus, probeAzureOpenAI } from "../src/lib/azureOpenAI";

function loadLocalEnvironment(): void {
  const filePath = resolve(process.cwd(), ".env.local");
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadLocalEnvironment();
  const status = getAzureOpenAIStatus();
  if (!status.configured) {
    throw new Error(`환경변수 누락: ${status.missing_env.join(", ")}`);
  }
  const result = await probeAzureOpenAI();
  console.log(`[azure:check] 연결 성공 (${status.api_version}): ${result.message}`);
}

void main().catch((error) => {
  console.error("[azure:check] 연결 실패", error);
  process.exitCode = 1;
});
