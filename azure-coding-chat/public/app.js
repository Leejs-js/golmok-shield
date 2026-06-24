const DEFAULT_SYSTEM_PROMPT = `You are an expert software engineering assistant.
Answer in the same language as the user unless asked otherwise.
Give concrete, correct, and directly usable guidance.
When writing code, use fenced code blocks with a language tag.
Call out assumptions, security risks, destructive commands, and version-sensitive details.
Prefer focused changes over unnecessary rewrites.`;

const STORAGE = {
  messages: "azure-coding-chat.messages.v1",
  systemPrompt: "azure-coding-chat.system-prompt.v1",
};

const state = {
  messages: loadMessages(),
  systemPrompt: localStorage.getItem(STORAGE.systemPrompt) || DEFAULT_SYSTEM_PROMPT,
  controller: null,
  isStreaming: false,
};

const elements = {
  backdrop: document.querySelector("#backdrop"),
  chatForm: document.querySelector("#chat-form"),
  chatScroll: document.querySelector("#chat-scroll"),
  clearButton: document.querySelector("#clear-button"),
  deploymentName: document.querySelector("#deployment-name"),
  menuButton: document.querySelector("#menu-button"),
  messageInput: document.querySelector("#message-input"),
  messages: document.querySelector("#messages"),
  newChat: document.querySelector("#new-chat"),
  resetPrompt: document.querySelector("#reset-prompt"),
  saveSettings: document.querySelector("#save-settings"),
  sendButton: document.querySelector("#send-button"),
  sendIcon: document.querySelector("#send-icon"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  sidebar: document.querySelector("#sidebar"),
  statusDot: document.querySelector("#status-dot"),
  statusTitle: document.querySelector("#status-title"),
  systemPrompt: document.querySelector("#system-prompt"),
  toast: document.querySelector("#toast"),
};

function loadMessages() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE.messages) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string",
    );
  } catch {
    return [];
  }
}

function saveMessages() {
  localStorage.setItem(STORAGE.messages, JSON.stringify(state.messages));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInline(value) {
  return escapeHtml(value)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
}

function renderTextBlock(text) {
  const lines = text.split("\n");
  const output = [];
  let listType = null;

  const closeList = () => {
    if (listType) output.push(`</${listType}>`);
    listType = null;
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const quote = line.match(/^>\s?(.*)$/);

    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
    } else if (unordered || ordered) {
      const desiredType = unordered ? "ul" : "ol";
      if (listType !== desiredType) {
        closeList();
        listType = desiredType;
        output.push(`<${listType}>`);
      }
      output.push(`<li>${renderInline((unordered || ordered)[1])}</li>`);
    } else if (quote) {
      closeList();
      output.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
    } else if (!line.trim()) {
      closeList();
    } else {
      closeList();
      output.push(`<p>${renderInline(line)}</p>`);
    }
  }

  closeList();
  return output.join("");
}

function renderMarkdown(content) {
  const parts = content.split(/(```[\w.+-]*\n[\s\S]*?```)/g);

  return parts
    .map((part) => {
      const match = part.match(/^```([\w.+-]*)\n([\s\S]*?)```$/);
      if (!match) return renderTextBlock(part);

      const language = match[1] || "code";
      return `<div class="code-block">
        <div class="code-header"><span>${escapeHtml(language)}</span><button class="copy-code" type="button">복사</button></div>
        <pre><code>${escapeHtml(match[2])}</code></pre>
      </div>`;
    })
    .join("");
}

function welcomeTemplate() {
  return `<div class="welcome">
    <div class="welcome-icon" aria-hidden="true">⌘</div>
    <h1>무엇을 만들어 볼까요?</h1>
    <p>요구사항, 코드, 에러 로그를 보내면 구현 방법부터 디버깅까지 대화 흐름을 유지하며 도와드립니다.</p>
    <div class="suggestions">
      <button class="suggestion" type="button" data-prompt="이 프로젝트 구조를 고려한 REST API 설계 방법을 제안해줘.">
        <strong>API 설계</strong><span>요구사항에 맞는 엔드포인트와 데이터 흐름 설계</span>
      </button>
      <button class="suggestion" type="button" data-prompt="아래 에러의 원인을 단계적으로 분석하고 수정안을 제시해줘:\n\n">
        <strong>오류 분석</strong><span>에러 로그에서 원인과 검증 가능한 해결책 찾기</span>
      </button>
      <button class="suggestion" type="button" data-prompt="아래 코드를 가독성, 성능, 안정성 관점에서 리뷰해줘:\n\n">
        <strong>코드 리뷰</strong><span>위험 요소와 우선순위가 명확한 개선안 받기</span>
      </button>
      <button class="suggestion" type="button" data-prompt="이 기능의 테스트 케이스를 정상, 경계, 실패 시나리오로 나눠 작성해줘:\n\n">
        <strong>테스트 작성</strong><span>핵심 동작과 경계 조건을 검증하는 테스트 구성</span>
      </button>
    </div>
  </div>`;
}

function messageTemplate(message, index) {
  const isUser = message.role === "user";
  const content =
    message.pending && !message.content
      ? '<div class="typing" aria-label="답변 생성 중"><span></span><span></span><span></span></div>'
      : renderMarkdown(message.content);

  return `<article class="message ${message.role}" data-index="${index}">
    ${isUser ? "" : '<div class="avatar" aria-hidden="true">AI</div>'}
    <div class="message-body">
      <div class="message-content">${content}</div>
      ${
        isUser
          ? ""
          : '<div class="message-actions"><button class="message-action" type="button" data-action="copy-message">답변 복사</button></div>'
      }
    </div>
    ${isUser ? '<div class="avatar" aria-hidden="true">ME</div>' : ""}
  </article>`;
}

function renderMessages() {
  if (!state.messages.length) {
    elements.messages.innerHTML = welcomeTemplate();
    return;
  }

  elements.messages.innerHTML = state.messages.map(messageTemplate).join("");
}

function updateLastAssistant() {
  const index = state.messages.length - 1;
  const node = elements.messages.querySelector(`.message[data-index="${index}"] .message-content`);
  if (!node) {
    renderMessages();
    return;
  }

  const message = state.messages[index];
  node.innerHTML =
    message.pending && !message.content
      ? '<div class="typing" aria-label="답변 생성 중"><span></span><span></span><span></span></div>'
      : renderMarkdown(message.content);
}

function scrollToBottom(behavior = "smooth") {
  elements.chatScroll.scrollTo({ top: elements.chatScroll.scrollHeight, behavior });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("visible"), 2400);
}

function autoResizeInput() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 220)}px`;
}

function setStreaming(isStreaming) {
  state.isStreaming = isStreaming;
  elements.messageInput.disabled = isStreaming;
  elements.sendButton.disabled = !isStreaming && !elements.messageInput.value.trim();
  elements.sendButton.classList.toggle("stop", isStreaming);
  elements.sendIcon.textContent = isStreaming ? "■" : "↑";
  elements.sendButton.setAttribute("aria-label", isStreaming ? "생성 중단" : "전송");
}

function resetChat() {
  if (state.controller) state.controller.abort();
  state.messages = [];
  saveMessages();
  setStreaming(false);
  renderMessages();
  elements.messageInput.focus();
  closeSidebar();
}

function parseSseChunk(buffer, onData) {
  const events = buffer.split("\n\n");
  const remainder = events.pop() || "";

  for (const event of events) {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (data) onData(data);
  }

  return remainder;
}

async function getErrorMessage(response) {
  try {
    const payload = await response.json();
    return payload.error || `요청 실패 (${response.status})`;
  } catch {
    return `요청 실패 (${response.status})`;
  }
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || state.isStreaming) return;

  state.messages.push({ role: "user", content });
  state.messages.push({ role: "assistant", content: "", pending: true });
  saveMessages();
  renderMessages();
  scrollToBottom("auto");

  elements.messageInput.value = "";
  autoResizeInput();
  state.controller = new AbortController();
  setStreaming(true);

  const assistant = state.messages.at(-1);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.messages
          .filter((message) => !message.pending)
          .map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        systemPrompt: state.systemPrompt,
      }),
      signal: state.controller.signal,
    });

    if (!response.ok) throw new Error(await getErrorMessage(response));
    if (!response.body) throw new Error("스트리밍 응답을 읽을 수 없습니다.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastPaint = 0;

    const handleData = (data) => {
      if (data === "[DONE]") return;
      try {
        const event = JSON.parse(data);
        if (event.error) throw new Error(event.error.message || event.error);
        if (event.type === "response.failed") {
          throw new Error(event.response?.error?.message || "Azure 응답 생성에 실패했습니다.");
        }
        assistant.content +=
          event.type === "response.output_text.delta"
            ? event.delta || ""
            : event.choices?.[0]?.delta?.content || "";
        const now = performance.now();
        if (now - lastPaint > 40) {
          updateLastAssistant();
          scrollToBottom("auto");
          lastPaint = now;
        }
      } catch (error) {
        if (error instanceof SyntaxError) return;
        throw error;
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      buffer = parseSseChunk(buffer.replaceAll("\r\n", "\n"), handleData);
      if (done) break;
    }

    if (buffer.trim()) parseSseChunk(`${buffer}\n\n`, handleData);
    if (!assistant.content) assistant.content = "응답 내용이 비어 있습니다.";
  } catch (error) {
    if (error.name === "AbortError") {
      if (!assistant.content) assistant.content = "응답 생성을 중단했습니다.";
    } else {
      assistant.content = `요청을 처리하지 못했습니다.\n\n> ${error.message}`;
    }
  } finally {
    assistant.pending = false;
    state.controller = null;
    saveMessages();
    updateLastAssistant();
    setStreaming(false);
    scrollToBottom("auto");
    elements.messageInput.focus();
  }
}

async function loadConnectionStatus() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const config = await response.json();

    elements.statusDot.className = `status-dot ${config.configured ? "connected" : "error"}`;
    elements.statusTitle.textContent = config.configured ? "설정 완료" : "설정 필요";
    elements.deploymentName.textContent = config.configured
      ? config.deployment
      : ".env 파일을 확인하세요";
  } catch {
    elements.statusDot.className = "status-dot error";
    elements.statusTitle.textContent = "서버 오류";
    elements.deploymentName.textContent = "연결 상태 확인 실패";
  }
}

function openSidebar() {
  elements.sidebar.classList.add("open");
  elements.backdrop.hidden = false;
}

function closeSidebar() {
  elements.sidebar.classList.remove("open");
  elements.backdrop.hidden = true;
}

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.isStreaming) {
    state.controller?.abort();
    return;
  }
  sendMessage(elements.messageInput.value);
});

elements.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    elements.chatForm.requestSubmit();
  }
});

elements.messageInput.addEventListener("input", () => {
  autoResizeInput();
  elements.sendButton.disabled = !elements.messageInput.value.trim();
});

elements.messages.addEventListener("click", async (event) => {
  const suggestion = event.target.closest("[data-prompt]");
  if (suggestion) {
    elements.messageInput.value = suggestion.dataset.prompt;
    autoResizeInput();
    elements.sendButton.disabled = false;
    elements.messageInput.focus();
    return;
  }

  const copyCode = event.target.closest(".copy-code");
  if (copyCode) {
    const code = copyCode.closest(".code-block").querySelector("code").textContent;
    await navigator.clipboard.writeText(code);
    copyCode.textContent = "복사됨";
    setTimeout(() => (copyCode.textContent = "복사"), 1400);
    return;
  }

  const copyMessage = event.target.closest('[data-action="copy-message"]');
  if (copyMessage) {
    const index = Number(copyMessage.closest(".message").dataset.index);
    await navigator.clipboard.writeText(state.messages[index].content);
    showToast("답변을 복사했습니다.");
  }
});

elements.newChat.addEventListener("click", resetChat);
elements.clearButton.addEventListener("click", resetChat);
elements.menuButton.addEventListener("click", openSidebar);
elements.backdrop.addEventListener("click", closeSidebar);

elements.settingsButton.addEventListener("click", () => {
  closeSidebar();
  elements.systemPrompt.value = state.systemPrompt;
  elements.settingsDialog.showModal();
});

elements.resetPrompt.addEventListener("click", () => {
  elements.systemPrompt.value = DEFAULT_SYSTEM_PROMPT;
});

elements.saveSettings.addEventListener("click", () => {
  const nextPrompt = elements.systemPrompt.value.trim() || DEFAULT_SYSTEM_PROMPT;
  state.systemPrompt = nextPrompt;
  localStorage.setItem(STORAGE.systemPrompt, nextPrompt);
  showToast("설정을 저장했습니다.");
});

renderMessages();
autoResizeInput();
setStreaming(false);
loadConnectionStatus();
elements.messageInput.focus();
