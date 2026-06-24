import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import type { ClusterSummary, DongScore } from "../src/lib/types";

export type RawRow = Record<string, string>;

const warned = new Set<string>();

function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[buildDongScoreTable] ${message}`);
}

function decodeText(buffer: Buffer): string {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    warnOnce("UTF-8 해독 실패: EUC-KR(CP949)로 다시 읽습니다.");
    return new TextDecoder("euc-kr").decode(buffer);
  }
}

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    else if (!quoted && line[index] === delimiter) count += 1;
  }
  return count;
}

function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0];
  return [",", "\t", ";", "|"]
    .map((delimiter) => ({ delimiter, count: countDelimiter(header, delimiter) }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function readTable(filePath: string): RawRow[] {
  const text = decodeText(readFileSync(filePath));
  const parsedRows = parseDelimited(text, detectDelimiter(text));
  const headers = parsedRows.shift()?.map((header) => header.replace(/^\ufeff/, "")) ?? [];
  return parsedRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function findNamedFile(modelDir: string, baseName: string): string {
  for (const name of [baseName, `${baseName}.csv`, `${baseName}.tsv`, `${baseName}.txt`]) {
    const filePath = join(modelDir, name);
    if (existsSync(filePath)) return filePath;
  }
  throw new Error(`${modelDir}에서 ${baseName} 파일을 찾지 못했습니다.`);
}

function findModelDirectory(start: string): string {
  const fromEnvironment = process.env.MODEL_DATA_DIR;
  if (fromEnvironment && existsSync(fromEnvironment)) return resolve(fromEnvironment);

  let current = resolve(start);
  while (true) {
    const candidate = join(current, "data", "model");
    if (
      existsSync(join(candidate, "dong_features")) ||
      existsSync(join(candidate, "dong_features.csv"))
    ) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("상위 경로에서 data/model 디렉터리를 찾지 못했습니다.");
}

const normalizedName = (value: string): string => value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

function columnCandidates(candidate: string, aliases: string[] = []): string[] {
  const names = [candidate, ...aliases];

  for (const name of [candidate, ...aliases]) {
    if (name.endsWith("_1")) {
      names.push(name.slice(0, -2));
    } else {
      names.push(`${name}_1`);
    }
  }

  return [...new Set(names)];
}

function resolveColumn(headers: string[], candidate: string, aliases: string[] = []): string | undefined {
  const candidates = columnCandidates(candidate, aliases);

  for (const name of candidates) {
    if (headers.includes(name)) {
      if (name !== candidate) {
        warnOnce(`누락 컬럼 ${candidate}: 유사 컬럼 ${name}을(를) 사용합니다.`);
      }
      return name;
    }
  }

  const possibleNames = candidates.map(normalizedName);
  const fuzzy = headers.find((header) => possibleNames.includes(normalizedName(header)));

  if (fuzzy) {
    warnOnce(`누락 컬럼 ${candidate}: 유사 컬럼 ${fuzzy}을(를) 사용합니다.`);
    return fuzzy;
  }

  warnOnce(`누락 컬럼 ${candidate}: 해당 지표를 제외하고 가중치를 재정규화합니다.`);
  return undefined;
}

function numeric(row: RawRow, column: string | undefined): number | undefined {
  if (!column) return undefined;
  const value = Number(row[column]);
  return Number.isFinite(value) ? value : undefined;
}

function minMax(values: Array<number | undefined>): Array<number | undefined> {
  const available = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (available.length === 0) return values.map(() => undefined);
  const minimum = Math.min(...available);
  const maximum = Math.max(...available);
  if (maximum === minimum) return values.map((value) => (value === undefined ? undefined : 50));
  return values.map((value) =>
    value === undefined ? undefined : ((value - minimum) / (maximum - minimum)) * 100,
  );
}

type ColumnSpec = { name: string; weight?: number; aliases?: string[]; invert?: boolean };

function weightedNormalized(rows: RawRow[], specs: ColumnSpec[]): number[] {
  const headers = Object.keys(rows[0] ?? {});
  const available = specs.flatMap((spec) => {
    const column = resolveColumn(headers, spec.name, spec.aliases);
    if (!column) return [];
    const normalized = minMax(rows.map((row) => numeric(row, column)));
    if (normalized.every((value) => value === undefined)) {
      warnOnce(`컬럼 ${column}에 유효한 숫자가 없어 제외합니다.`);
      return [];
    }
    return [{ normalized, weight: spec.weight ?? 1, invert: spec.invert ?? false }];
  });

  return rows.map((_, rowIndex) => {
    let total = 0;
    let weightSum = 0;
    for (const item of available) {
      const value = item.normalized[rowIndex];
      if (value === undefined) continue;
      total += (item.invert ? 100 - value : value) * item.weight;
      weightSum += item.weight;
    }
    return weightSum === 0 ? 0 : total / weightSum;
  });
}

function ageRatioScore(rows: RawRow[], ageCandidates: string[]): number[] {
  const headers = Object.keys(rows[0] ?? {});
  const ageColumns = ageCandidates.map((name) => resolveColumn(headers, name));
  const totalColumn = resolveColumn(headers, "tot_pop_1");

  if (ageColumns.every(Boolean) && totalColumn) {
    const ratios = rows.map((row) => {
      const total = numeric(row, totalColumn);
      if (!total || total <= 0) return undefined;
      const ages = ageColumns.map((column) => numeric(row, column));
      if (ages.some((value) => value === undefined)) return undefined;
      return ages.reduce<number>((sum, value) => sum + (value ?? 0), 0) / total;
    });
    return minMax(ratios).map((value) => value ?? 0);
  }

  return weightedNormalized(rows, ageCandidates.map((name) => ({ name })));
}

const round2 = (value: number): number => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;

export function buildScoreTableFromRows(
  featureRows: RawRow[],
  clusterRows: RawRow[],
): DongScore[] {
  if (featureRows.length === 0) throw new Error("dong_features에 데이터 행이 없습니다.");
  const clusterByDong = new Map(clusterRows.map((row) => [row.dong_nm, row]));

  const young = weightedNormalized(featureRows, [
    { name: "youth_ratio_1", weight: 2 },
    { name: "cafe_youth_sales_ratio_1", weight: 1.5 },
    { name: "cafe_30s_sales_ratio_1" },
  ]);

  const middleSenior = weightedNormalized(featureRows, [
    { name: "mid_age_ratio_1", weight: 1.5 },
    { name: "senior_ratio_1" },
  ]);

  const office = weightedNormalized(featureRows, [
    { name: "office_worker_proxy_1", weight: 2 },
    { name: "weekday_dominance_1" },
    { name: "weekday_sales_ratio_1" },
    { name: "lunch_peak_ratio_1" },
  ]);

  const local = weightedNormalized(featureRows, [
    { name: "population_density_1" },
    { name: "stay_type_index_1" },
    { name: "cafe_density_per_pop_1", weight: 0.5 },
  ]);

  const access = weightedNormalized(featureRows, [
    { name: "subway_accessibility_1" },
  ]);

  const scale = weightedNormalized(featureRows, [
    { name: "commercial_scale_1", weight: 2 },
    { name: "food_biz_ratio_1" },
    { name: "cafe_density_per_pop_1" },
  ]);

  const lowCompetition = weightedNormalized(featureRows, [
    { name: "similar_store_density_1", invert: true },
    { name: "market_saturation_1", invert: true },
    { name: "store_turnover_1", invert: true },
  ]);

  const growth = weightedNormalized(featureRows, [
    { name: "market_growth_idx_1", weight: 2 },
    { name: "premium_score_1" },
    { name: "avg_ticket_index_1" },
  ]);

  const trend = weightedNormalized(featureRows, [
    { name: "cafe_youth_sales_ratio_1", weight: 1.5 },
    { name: "cafe_afternoon_ratio_1" },
    { name: "cafe_weekend_dep_1" },
    { name: "premium_score_1" },
    { name: "market_growth_idx_1" },
  ]);

  return featureRows.map((row, index) => {
    const cluster = clusterByDong.get(row.dong_nm);
    if (!cluster) warnOnce(`dong_cluster_result에 ${row.dong_nm}이(가) 없어 features의 군집값을 사용합니다.`);
    return {
      dong_nm: row.dong_nm,
      cluster_id: Number(cluster?.cluster_id ?? row.cluster_id ?? -1),
      cluster_type: cluster?.cluster_type ?? row.cluster_type ?? "군집 정보 없음",
      young_score: round2(young[index]),
      middle_senior_score: round2(middleSenior[index]),
      office_score: round2(office[index]),
      local_score: round2(local[index]),
      trend_score: round2(trend[index]),
      access_score: round2(access[index]),
      scale_score: round2(scale[index]),
      low_competition_score: round2(lowCompetition[index]),
      growth_score: round2(growth[index]),
    };
  });
}

function convertClusterRows(rows: RawRow[]): Array<{ dong_nm: string; cluster_id: number; cluster_type: string }> {
  return rows.map((row) => ({
    dong_nm: row.dong_nm,
    cluster_id: Number(row.cluster_id),
    cluster_type: row.cluster_type,
  }));
}

function convertSummaryRows(rows: RawRow[]): ClusterSummary[] {
  return rows.map((row) => ({
    cluster_id: Number(row.cluster_id),
    cluster_type: row.cluster_type,
    description: row.description,
    dong_list: row.dong_list,
    dong_count: Number(row.dong_count),
  }));
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: DongScore[]): string {
  const headers = Object.keys(rows[0] ?? {});
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof DongScore])).join(",")),
  ].join("\n") + "\n";
}

export function buildFiles(): void {
  const projectDirectory = resolve(__dirname, "..", "..");
  const modelDirectory = findModelDirectory(projectDirectory);
  const featureRows = readTable(findNamedFile(modelDirectory, "dong_features"));
  const clusterRows = readTable(findNamedFile(modelDirectory, "dong_cluster_result"));
  const summaryRows = readTable(findNamedFile(modelDirectory, "cluster_summary"));

  const scores = buildScoreTableFromRows(featureRows, clusterRows);
  const clusters = convertClusterRows(clusterRows);
  const summaries = convertSummaryRows(summaryRows);
  const dataDirectory = join(projectDirectory, "src", "data");
  const processedDirectory = join(projectDirectory, "data", "processed");
  mkdirSync(dataDirectory, { recursive: true });
  mkdirSync(processedDirectory, { recursive: true });

  writeFileSync(join(dataDirectory, "dong_score_table.json"), `${JSON.stringify(scores, null, 2)}\n`, "utf8");
  writeFileSync(join(dataDirectory, "dong_cluster_result.json"), `${JSON.stringify(clusters, null, 2)}\n`, "utf8");
  writeFileSync(join(dataDirectory, "cluster_summary.json"), `${JSON.stringify(summaries, null, 2)}\n`, "utf8");
  writeFileSync(join(processedDirectory, "dong_score_table.csv"), toCsv(scores), "utf8");

  console.log(`[buildDongScoreTable] ${parse(modelDirectory).name}: 행정동 ${scores.length}개, 군집 ${summaries.length}개 생성 완료`);
}

if (require.main === module) {
  try {
    buildFiles();
  } catch (error) {
    console.error("[buildDongScoreTable] 생성 실패", error);
    process.exitCode = 1;
  }
}
