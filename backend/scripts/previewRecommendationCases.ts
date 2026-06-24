import dongScoreTableRaw from "../src/data/dong_score_table.json";
import { balanceGameQuestions } from "../src/lib/balanceGameQuestions";
import { makePreferenceVector } from "../src/lib/preference";
import { recommendDongs } from "../src/lib/recommend";
import type { Answer, DongScore } from "../src/lib/types";

const dongScoreTable = dongScoreTableRaw as DongScore[];

function codeToAnswers(code: string): Answer[] {
  return balanceGameQuestions.map((question, index) => {
    const choice = code[index];
    const optionIndex = choice === "1" ? 0 : 1;
    const option = question.options[optionIndex];

    if (!option) {
      throw new Error(`문항 ${question.id}에 ${choice}번 선택지가 없습니다.`);
    }

    return {
      question_id: question.id,
      selected: option.id,
    };
  });
}

function generateCodes(): string[] {
  const result: string[] = [];

  for (let i = 0; i < 32; i += 1) {
    const binary = i.toString(2).padStart(5, "0");
    const code = binary
      .split("")
      .map((bit) => (bit === "0" ? "1" : "2"))
      .join("");

    result.push(code);
  }

  return result;
}

console.log("| 선택코드 | Top1 | Top2 | Top3 | Bad1 | Bad2 | Bad3 |");
console.log("|---|---|---|---|---|---|---|");

for (const code of generateCodes()) {
  const answers = codeToAnswers(code);
  const userVector = makePreferenceVector(answers);
  const result = recommendDongs(userVector, dongScoreTable);

  const top = result.recommendations.map((item) => item.dong_nm);
  const bad = result.not_recommended.map((item) => item.dong_nm);

  console.log(
    `| ${code} | ${top[0] ?? ""} | ${top[1] ?? ""} | ${top[2] ?? ""} | ${bad[0] ?? ""} | ${bad[1] ?? ""} | ${bad[2] ?? ""} |`,
  );
}