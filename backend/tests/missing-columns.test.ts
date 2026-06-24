import assert from "node:assert/strict";
import test from "node:test";
import { buildScoreTableFromRows, type RawRow } from "../scripts/buildDongScoreTable";

test("후보 컬럼이 다수 없어도 점수 생성은 중단되지 않는다", () => {
  const features: RawRow[] = [
    { dong_nm: "가동", pop_20s_1: "10", cluster_id: "0", cluster_type: "테스트" },
    { dong_nm: "나동", pop_20s_1: "20", cluster_id: "1", cluster_type: "테스트" },
  ];
  const clusters: RawRow[] = [
    { dong_nm: "가동", cluster_id: "0", cluster_type: "테스트 A" },
    { dong_nm: "나동", cluster_id: "1", cluster_type: "테스트 B" },
  ];

  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const result = buildScoreTableFromRows(features, clusters);
    assert.equal(result.length, 2);
    assert.ok(warnings.length > 0);
    for (const row of result) {
      const scores = Object.entries(row)
        .filter(([key]) => key.endsWith("_score"))
        .map(([, value]) => value as number);
      assert.ok(scores.every((score) => score >= 0 && score <= 100));
    }
  } finally {
    console.warn = originalWarn;
  }
});
