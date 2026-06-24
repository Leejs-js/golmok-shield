import { APP_CONFIG } from "./js/config.js";
import { createMapAdapter } from "./js/map-adapters.js";

const questions = [
  { id:"marketStyle", title:"어떤 동네에 카페를 열고 싶나요?", hint:"가게 주변의 분위기를 떠올려 보세요.", options:[
    { label:"트렌디한 대형 상권", desc:"사람이 많고 새로움이 빠르게 퍼지는 곳", key:"trend" },
    { label:"숨은 골목 상권", desc:"단골과 동네의 온기가 쌓이는 곳", key:"alley" }] },
  { id:"timeStyle", title:"당신의 카페가 빛날 시간은?", hint:"주력 메뉴와 운영 시간을 기준으로 골라보세요.", options:[
    { label:"햇살 좋은 낮", desc:"브런치·업무·공부 수요가 많은 시간", key:"day" },
    { label:"분위기 있는 밤", desc:"저녁 약속과 야간 소비가 이어지는 시간", key:"night" }] },
  { id:"targetCustomer", title:"가장 만나고 싶은 손님은?", hint:"주 고객의 하루를 상상해 보세요.", options:[
    { label:"바쁜 직장인", desc:"출근길·점심·퇴근길의 반복 수요", key:"office" },
    { label:"대학생과 20대", desc:"취향과 경험을 공유하는 젊은 고객", key:"young" }] },
  { id:"salesPattern", title:"어떤 매출 흐름이 더 끌리나요?", hint:"안정성과 피크 중 하나를 선택해 보세요.", options:[
    { label:"주중의 꾸준함", desc:"월요일부터 금요일까지 안정적인 매출", key:"weekday" },
    { label:"주말의 폭발력", desc:"나들이 수요가 몰리는 강한 주말 매출", key:"weekend" }] },
  { id:"competition", title:"입지에서 더 중요한 것은?", hint:"인지도와 진입 기회 사이의 선택입니다.", options:[
    { label:"많은 유동인구", desc:"경쟁이 있어도 큰 시장을 선택", key:"traffic" },
    { label:"적은 경쟁", desc:"아직 여유가 있는 틈새 상권을 선택", key:"lowCompetition" }] },
  { id:"pricing", title:"당신의 메뉴 전략에 가까운 것은?", hint:"가격과 판매량의 균형을 골라보세요.", options:[
    { label:"프리미엄 객단가", desc:"공간과 메뉴 경험에 집중", key:"premium" },
    { label:"가성비 회전율", desc:"친근한 가격으로 자주 찾게 만들기", key:"turnover" }] },
  { id:"space", title:"카페를 어떻게 이용하길 바라나요?", hint:"손님이 머무는 장면을 떠올려 보세요.", options:[
    { label:"빠른 테이크아웃", desc:"동선이 빠르고 접근성이 중요한 매장", key:"takeout" },
    { label:"오래 머무는 공간", desc:"대화와 작업을 위한 편안한 매장", key:"stay" }] }
];

const state = { step:0, answers:{}, areas:[], results:null, activeTab:"best", map:null };
const views = ["introView","quizView","loadingView","resultView"];
const $ = (id) => document.getElementById(id);

function showView(id) {
  views.forEach((viewId) => $(viewId).classList.toggle("is-active", viewId === id));
  window.scrollTo({ top:0, behavior:"smooth" });
}

function renderQuestion() {
  const question = questions[state.step];
  $("progressLabel").textContent = `${state.step + 1} / ${questions.length}`;
  $("progressBar").style.width = `${((state.step + 1) / questions.length) * 100}%`;
  $("questionTitle").textContent = question.title;
  $("questionHint").textContent = question.hint;
  $("quizBack").style.visibility = state.step ? "visible" : "hidden";
  const container = $("answerOptions");
  container.innerHTML = "";
  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "answer-card";
    button.innerHTML = `<span class="letter">${index ? "B" : "A"}</span><strong>${option.label}</strong><span>${option.desc}</span>`;
    button.addEventListener("click", () => selectAnswer(question.id, option));
    container.appendChild(button);
  });
}

function selectAnswer(questionId, option) {
  state.answers[questionId] = option.key;
  if (state.step < questions.length - 1) { state.step += 1; renderQuestion(); }
  else runRecommendation();
}

async function loadAreas() {
  if (state.areas.length) return state.areas;
  const response = await fetch("./assets/data/areas.json");
  if (!response.ok) throw new Error("지역 데이터를 불러오지 못했습니다.");
  state.areas = await response.json();
  return state.areas;
}

function localRecommend(areas) {
  const selected = Object.values(state.answers);
  const ranked = areas.map((area) => {
    const values = selected.map((key) => area.profile[key] ?? 50);
    const match = values.reduce((sum, value) => sum + value, 0) / values.length;
    const stability = (area.profile.day + area.profile.weekday + area.profile.lowCompetition) / 3;
    const score = Math.round(Math.min(97, match * .82 + stability * .18));
    return { ...area, score, reasons: makeReasons(area, selected, true) };
  }).sort((a,b) => b.score - a.score);
  const best = ranked.slice(0,3);
  const worst = [...ranked].sort((a,b) => a.score - b.score).filter((area) => !best.some((item) => item.dong === area.dong)).slice(0,3).map((area) => ({ ...area, score:Math.min(97, Math.round(100 - area.score + 35)), reasons:makeReasons(area, selected, false) }));
  return { best, worst, persona: buildPersona(), model:{ provider:"local", label:"K-Means Local + Weighted Scoring" } };
}

const traitLabels = { trend:"트렌디한 상권 성향",alley:"골목·생활형 분위기",day:"낮 시간대 수요",night:"저녁 소비 활력",office:"직장인 반복 수요",young:"청년층 친화도",weekday:"주중 안정성",weekend:"주말 방문 수요",traffic:"교통·유입 접근성",lowCompetition:"상대적으로 낮은 경쟁",premium:"프리미엄 소비 여력",turnover:"높은 회전 가능성",takeout:"테이크아웃 동선",stay:"체류형 공간 수요" };

function makeReasons(area, selected, positive) {
  const pairs = selected.map((key) => [key, area.profile[key] ?? 50]);
  pairs.sort((a,b) => positive ? b[1]-a[1] : a[1]-b[1]);
  return pairs.slice(0,2).map(([key,value]) => positive ? `${traitLabels[key]}이 ${value}점으로 취향과 잘 맞아요` : `${traitLabels[key]}이 ${value}점으로 기대와 차이가 있어요`);
}

function buildPersona() {
  const map = { trend:"트렌드 중심",alley:"골목 중심",day:"낮상권",night:"밤상권",office:"직장인 타깃",young:"청년 타깃",weekday:"주중 안정형",weekend:"주말 집중형" };
  const main = [state.answers.marketStyle,state.answers.timeStyle,state.answers.targetCustomer,state.answers.salesPattern].map((key) => map[key]);
  return { title:`${main.join(" · ")} 창업자`, description:"선택한 운영 방식과 고객층을 기준으로 마포구 상권을 비교했습니다." };
}

async function runRecommendation() {
  showView("loadingView");
  const messages = ["16개 동의 상권 특성을 비교하는 중...","K-Means 군집 유형을 확인하는 중...","당신의 취향과 골목의 궁합을 계산하는 중..."];
  let messageIndex = 0;
  const ticker = setInterval(() => { messageIndex = (messageIndex + 1) % messages.length; $("loadingMessage").textContent = messages[messageIndex]; }, 750);
  try {
    const areas = await loadAreas();
    let result;
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/recommend`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ answers:state.answers }) });
      if (!response.ok) throw new Error("API unavailable");
      result = await response.json();
    } catch { result = localRecommend(areas); }
    await new Promise((resolve) => setTimeout(resolve, 1100));
    state.results = result;
    renderResults();
  } catch (error) {
    alert(error.message || "분석 중 오류가 발생했습니다.");
    showView("quizView");
  } finally { clearInterval(ticker); }
}

function renderResults() {
  $("personaTitle").textContent = state.results.persona.title;
  $("personaDescription").textContent = state.results.persona.description;
  $("modelLabel").textContent = state.results.model?.label || "K-Means Local";
  state.activeTab = "best";
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === "best"));
  showView("resultView");
  renderRanking();
  requestAnimationFrame(() => {
    if (!state.map) state.map = createMapAdapter("map", APP_CONFIG);
    state.map.invalidateSize();
    state.map.setResults(state.results, (area, kind) => { state.activeTab = kind; syncTabs(); renderRanking(area.dong); });
  });
}

function renderRanking(selectedDong) {
  const list = $("rankingList"); list.innerHTML = "";
  list.classList.toggle("worst-mode", state.activeTab === "worst");
  state.results[state.activeTab].forEach((area,index) => {
    const card = $("rankingCardTemplate").content.firstElementChild.cloneNode(true);
    card.dataset.dong = area.dong; card.classList.toggle("is-selected", area.dong === selectedDong);
    card.querySelector(".rank-number").textContent = index + 1;
    card.querySelector(".rank-kind").textContent = state.activeTab === "best" ? "추천 지역" : "주의 지역";
    card.querySelector(".rank-dong").textContent = area.dong;
    card.querySelector(".score-ring strong").textContent = area.score;
    card.querySelector(".cluster-pill").textContent = area.clusterName;
    const reasons = card.querySelector(".reason-list");
    area.reasons.slice(0,2).forEach((reason) => { const li=document.createElement("li"); li.textContent=reason; reasons.appendChild(li); });
    const focus = () => { state.map?.focus(area.dong); document.querySelectorAll(".ranking-card").forEach((item) => item.classList.toggle("is-selected", item.dataset.dong === area.dong)); };
    card.addEventListener("click", focus); card.addEventListener("keydown", (event) => { if (event.key === "Enter") focus(); });
    list.appendChild(card);
  });
}

function syncTabs() {
  document.querySelectorAll(".tab").forEach((tab) => { const active=tab.dataset.tab===state.activeTab; tab.classList.toggle("is-active",active); tab.setAttribute("aria-selected",String(active)); });
}

function resetQuiz() { state.step=0; state.answers={}; renderQuestion(); showView("quizView"); }

$("startButton").addEventListener("click", resetQuiz);
$("quizBack").addEventListener("click", () => { if (state.step) { state.step -= 1; renderQuestion(); } });
$("restartQuiz").addEventListener("click", resetQuiz);
$("retryButton").addEventListener("click", resetQuiz);
$("fitMap").addEventListener("click", () => state.map?.fitAll());
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => { state.activeTab=tab.dataset.tab; syncTabs(); renderRanking(); }));
document.querySelector(".brand").addEventListener("click", (event) => { event.preventDefault(); showView("introView"); });
loadAreas().catch(() => {});
