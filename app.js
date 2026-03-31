const state = {
  cards: [],
  filteredCards: [],
  currentIndex: 0,
  revealDefinition: false,
  revealKeywords: false,
  autoMode: false,
  timerId: null,
  countdownId: null,
  countdownValue: null,
  phase: "question",
};

const elements = {
  categoryFilter: document.getElementById("categoryFilter"),
  shuffleToggle: document.getElementById("shuffleToggle"),
  thinkSeconds: document.getElementById("thinkSeconds"),
  revealSeconds: document.getElementById("revealSeconds"),
  autoToggle: document.getElementById("autoToggle"),
  cardPosition: document.getElementById("cardPosition"),
  cardCategory: document.getElementById("cardCategory"),
  cardSource: document.getElementById("cardSource"),
  phaseLabel: document.getElementById("phaseLabel"),
  countdown: document.getElementById("countdown"),
  questionText: document.getElementById("questionText"),
  definitionText: document.getElementById("definitionText"),
  keywordsText: document.getElementById("keywordsText"),
  definitionPanel: document.getElementById("definitionPanel"),
  keywordsPanel: document.getElementById("keywordsPanel"),
  showDefinitionBtn: document.getElementById("showDefinitionBtn"),
  showKeywordsBtn: document.getElementById("showKeywordsBtn"),
  showAllBtn: document.getElementById("showAllBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
};

function clearTimers() {
  if (state.timerId) {
    window.clearTimeout(state.timerId);
    state.timerId = null;
  }
  if (state.countdownId) {
    window.clearInterval(state.countdownId);
    state.countdownId = null;
  }
  state.countdownValue = null;
}

function startCountdown(seconds) {
  state.countdownValue = seconds;
  elements.countdown.textContent = `${seconds}s`;

  if (state.countdownId) {
    window.clearInterval(state.countdownId);
  }

  state.countdownId = window.setInterval(() => {
    state.countdownValue -= 1;
    if (state.countdownValue <= 0) {
      window.clearInterval(state.countdownId);
      state.countdownId = null;
      elements.countdown.textContent = "0s";
      return;
    }
    elements.countdown.textContent = `${state.countdownValue}s`;
  }, 1000);
}

function getCard() {
  return state.filteredCards[state.currentIndex] ?? null;
}

function resetRevealState() {
  state.revealDefinition = false;
  state.revealKeywords = false;
  state.phase = "question";
}

function setPanelVisible(panel, visible) {
  panel.classList.toggle("hidden", !visible);
  panel.classList.toggle("revealed", visible);
}

function renderCard() {
  const card = getCard();
  if (!card) {
    elements.cardPosition.textContent = "0 / 0";
    elements.cardCategory.textContent = "-";
    elements.cardSource.textContent = "카드를 찾지 못했습니다";
    elements.questionText.textContent = "조건에 맞는 카드가 없습니다.";
    elements.definitionText.textContent = "";
    elements.keywordsText.textContent = "";
    setPanelVisible(elements.definitionPanel, false);
    setPanelVisible(elements.keywordsPanel, false);
    elements.phaseLabel.textContent = "대기";
    elements.countdown.textContent = "-";
    return;
  }

  elements.cardPosition.textContent = `${state.currentIndex + 1} / ${state.filteredCards.length}`;
  elements.cardCategory.textContent = card.category || "-";
  elements.cardSource.textContent = `${card.sourceTitle} · ${card.number}번`;
  elements.questionText.textContent = card.question;
  elements.definitionText.textContent = card.definition || "정의가 비어 있습니다.";
  elements.keywordsText.textContent = card.keywords || "키워드가 비어 있습니다.";
  elements.phaseLabel.textContent = state.phase === "question" ? "문제 확인" : "정의/키워드 확인";

  setPanelVisible(elements.definitionPanel, state.revealDefinition);
  setPanelVisible(elements.keywordsPanel, state.revealKeywords);

  if (!state.autoMode && state.countdownValue === null) {
    elements.countdown.textContent = "-";
  }
}

function nextCard() {
  if (!state.filteredCards.length) return;
  state.currentIndex = (state.currentIndex + 1) % state.filteredCards.length;
  resetRevealState();
  renderCard();
  if (state.autoMode) {
    runAutoCycle();
  }
}

function prevCard() {
  if (!state.filteredCards.length) return;
  state.currentIndex = (state.currentIndex - 1 + state.filteredCards.length) % state.filteredCards.length;
  resetRevealState();
  renderCard();
  if (state.autoMode) {
    runAutoCycle();
  }
}

function revealDefinition() {
  state.revealDefinition = true;
  state.phase = "answer";
  renderCard();
}

function revealKeywords() {
  state.revealKeywords = true;
  state.phase = "answer";
  renderCard();
}

function revealAll() {
  state.revealDefinition = true;
  state.revealKeywords = true;
  state.phase = "answer";
  renderCard();
}

function shuffleCards(list) {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function applyFilters() {
  const category = elements.categoryFilter.value;
  const base = category === "all"
    ? [...state.cards]
    : state.cards.filter((card) => card.category === category);

  state.filteredCards = elements.shuffleToggle.checked ? shuffleCards(base) : base;
  state.currentIndex = 0;
  resetRevealState();
  clearTimers();
  if (state.autoMode) {
    state.autoMode = false;
    elements.autoToggle.textContent = "자동 시작";
  }
  renderCard();
}

function runAutoCycle() {
  clearTimers();

  const thinkSeconds = Math.max(3, Number(elements.thinkSeconds.value) || 12);
  const revealSeconds = Math.max(2, Number(elements.revealSeconds.value) || 8);

  resetRevealState();
  renderCard();
  startCountdown(thinkSeconds);

  state.timerId = window.setTimeout(() => {
    revealAll();
    startCountdown(revealSeconds);

    state.timerId = window.setTimeout(() => {
      nextCard();
    }, revealSeconds * 1000);
  }, thinkSeconds * 1000);
}

function toggleAutoMode() {
  state.autoMode = !state.autoMode;
  elements.autoToggle.textContent = state.autoMode ? "자동 정지" : "자동 시작";

  if (!state.autoMode) {
    clearTimers();
    elements.countdown.textContent = "-";
    return;
  }

  runAutoCycle();
}

function setupCategoryOptions(cards) {
  const categories = [...new Set(cards.map((card) => card.category).filter(Boolean))].sort();
  elements.categoryFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = `전체 (${cards.length})`;
  elements.categoryFilter.appendChild(allOption);

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  }
}

function bindEvents() {
  elements.categoryFilter.addEventListener("change", applyFilters);
  elements.shuffleToggle.addEventListener("change", applyFilters);
  elements.autoToggle.addEventListener("click", toggleAutoMode);
  elements.showDefinitionBtn.addEventListener("click", revealDefinition);
  elements.showKeywordsBtn.addEventListener("click", revealKeywords);
  elements.showAllBtn.addEventListener("click", revealAll);
  elements.prevBtn.addEventListener("click", prevCard);
  elements.nextBtn.addEventListener("click", nextCard);

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      revealAll();
    }

    if (event.key === "ArrowRight") {
      nextCard();
    }

    if (event.key.toLowerCase() === "a") {
      toggleAutoMode();
    }
  });
}

async function init() {
  const response = await fetch("./data/cards.json", { cache: "no-store" });
  state.cards = await response.json();
  setupCategoryOptions(state.cards);
  state.filteredCards = [...state.cards];
  bindEvents();
  renderCard();
}

init().catch((error) => {
  console.error(error);
  elements.questionText.textContent = "카드 데이터를 불러오지 못했습니다.";
  elements.cardSource.textContent = "data/cards.json 확인 필요";
});
