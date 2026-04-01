const PRE_COUNTDOWN_SECONDS = 3;
const runtime = {
  isDesktopWidget:
    new URLSearchParams(window.location.search).get("mode") === "widget" ||
    Boolean(window.beepbeepDesktop?.isDesktopWidget)
};
document.body.classList.toggle("desktop-widget", runtime.isDesktopWidget);

const state = {
  cards: [],
  filteredCards: [],
  currentIndex: 0,
  revealDefinition: false,
  revealKeywords: false,
  alwaysReveal: false,
  now: Date.now(),
  timerLoopId: null,
  timerConfig: {
    totalDuration: 80,
    alertDuration: 3,
    repeatCount: 20,
  },
  timerInputs: {
    totalDuration: "80",
    alertDuration: "3",
    repeatCount: "20",
  },
  timerPhase: {
    mode: "idle",
  },
  spokenEnabled: true,
  lastSpokenSecond: null,
  studyMode: false,
  widgetAutoAdvanceId: null,
  widgetAutoAdvanceEnabled: true,
  widgetAutoEndsAt: 0,
};

const elements = {
  categoryFilter: document.getElementById("categoryFilter"),
  shuffleToggle: document.getElementById("shuffleToggle"),
  cardPosition: document.getElementById("cardPosition"),
  cardCategory: document.getElementById("cardCategory"),
  cardSource: document.getElementById("cardSource"),
  cycleProgress: document.getElementById("cycleProgress"),
  currentSet: document.getElementById("currentSet"),
  remainingTime: document.getElementById("remainingTime"),
  configuredTotalTime: document.getElementById("configuredTotalTime"),
  timerStatus: document.getElementById("timerStatus"),
  timerMessage: document.getElementById("timerMessage"),
  timerSubMessage: document.getElementById("timerSubMessage"),
  spokenEnabled: document.getElementById("spokenEnabled"),
  alwaysRevealToggle: document.getElementById("alwaysRevealToggle"),
  finishAudio: document.getElementById("finishAudio"),
  studyShell: document.getElementById("studyShell"),
  studyBackdrop: document.getElementById("studyBackdrop"),
  studyCardContent: document.getElementById("studyCardContent"),
  studyRemainingTime: document.getElementById("studyRemainingTime"),
  studyTotalRemainingTime: document.getElementById("studyTotalRemainingTime"),
  closeStudyBtn: document.getElementById("closeStudyBtn"),
  totalDuration: document.getElementById("totalDuration"),
  alertDuration: document.getElementById("alertDuration"),
  repeatCount: document.getElementById("repeatCount"),
  startTimerBtn: document.getElementById("startTimerBtn"),
  pauseTimerBtn: document.getElementById("pauseTimerBtn"),
  resumeTimerBtn: document.getElementById("resumeTimerBtn"),
  resetTimerBtn: document.getElementById("resetTimerBtn"),
  questionText: document.getElementById("questionText"),
  definitionText: document.getElementById("definitionText"),
  keywordsText: document.getElementById("keywordsText"),
  definitionAnswerBlock: document.getElementById("definitionAnswerBlock"),
  keywordsBlock: document.getElementById("keywordsBlock"),
  showDefinitionBtn: document.getElementById("showDefinitionBtn"),
  showKeywordsBtn: document.getElementById("showKeywordsBtn"),
  showAllBtn: document.getElementById("showAllBtn"),
  widgetTimerSeconds: document.getElementById("widgetTimerSeconds"),
  widgetAutoToggleBtn: document.getElementById("widgetAutoToggleBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn")
};

function stopTimerLoop() {
  if (state.timerLoopId) {
    window.clearInterval(state.timerLoopId);
    state.timerLoopId = null;
  }
}

function stopWidgetAutoAdvance() {
  if (state.widgetAutoAdvanceId) {
    window.clearInterval(state.widgetAutoAdvanceId);
    state.widgetAutoAdvanceId = null;
  }
}

function cancelSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  state.lastSpokenSecond = null;
}

function playWidgetCue() {
  if (!runtime.isDesktopWidget || !state.spokenEnabled || !elements.finishAudio) {
    return;
  }

  elements.finishAudio.currentTime = 0;
  elements.finishAudio.play().catch(() => {});
}

function speakNumber(value) {
  if (!state.spokenEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(String(value));
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

function clampInput(value, minimum, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(minimum, parsed);
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatLongTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getConfiguredCycleSeconds(useInputs = false) {
  if (useInputs) {
    const duration = clampInput(state.timerInputs.totalDuration, 1, state.timerConfig.totalDuration);
    const repeatCount = clampInput(state.timerInputs.repeatCount, 1, state.timerConfig.repeatCount);
    return duration * repeatCount;
  }

  return state.timerConfig.totalDuration * state.timerConfig.repeatCount;
}

function getCard() {
  return state.filteredCards[state.currentIndex] ?? null;
}

function resetStudyScroll() {
  if (elements.studyCardContent) {
    elements.studyCardContent.scrollTop = 0;
  }
}

function openStudyMode() {
  state.studyMode = true;
  document.body.classList.add("study-mode");
  elements.studyShell?.classList.add("is-overlay");
  resetStudyScroll();
}

function closeStudyMode() {
  state.studyMode = false;
  document.body.classList.remove("study-mode");
  elements.studyShell?.classList.remove("is-overlay");
}

function applyDesktopWidgetSettings(settings = {}) {
  if (!runtime.isDesktopWidget) {
    return;
  }

  document.body.classList.toggle("widget-transparent", Boolean(settings.transparentBackground));
}

function syncWidgetLayout() {
  if (!runtime.isDesktopWidget) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  document.body.classList.toggle("widget-narrow", width < 470);
  document.body.classList.toggle("widget-wide", width >= 620);
  document.body.classList.toggle("widget-short", height < 760);
  document.body.classList.toggle("widget-tall", height >= 900);
}

function syncMobileStudyLayout() {
  if (runtime.isDesktopWidget || !state.studyMode || !elements.studyCardContent) {
    return;
  }

  const isLandscapeMobile = window.matchMedia("(max-width: 932px) and (orientation: landscape)").matches;
  if (isLandscapeMobile) {
    resetStudyScroll();
  }
}

function resetRevealState() {
  state.revealDefinition = false;
  state.revealKeywords = true;
}

function setPanelVisible(panel, visible) {
  panel.classList.toggle("hidden", !visible);
  panel.classList.toggle("revealed", visible);
}

function syncWidgetAutoToggleLabel() {
  if (!elements.widgetAutoToggleBtn) {
    return;
  }
  const remainingSeconds = state.widgetAutoAdvanceEnabled
    ? Math.max(Math.ceil((state.widgetAutoEndsAt - Date.now()) / 1000), 0)
    : 0;
  elements.widgetAutoToggleBtn.textContent = state.widgetAutoAdvanceEnabled ? `Auto ${remainingSeconds}` : "Auto";
  elements.widgetAutoToggleBtn.classList.toggle("button-accent", state.widgetAutoAdvanceEnabled);
  elements.widgetAutoToggleBtn.classList.toggle("button-ghost", !state.widgetAutoAdvanceEnabled);
  elements.widgetAutoToggleBtn.setAttribute("aria-pressed", String(state.widgetAutoAdvanceEnabled));
  elements.widgetAutoToggleBtn.title = state.widgetAutoAdvanceEnabled ? "자동넘기기 켜짐" : "자동넘기기 꺼짐";
}

function getTimerDisplay() {
  const config = state.timerConfig;
  const phase = state.timerPhase;

  if (phase.mode === "idle") {
    return {
      round: 0,
      remainingSeconds: config.totalDuration,
      status: "대기 중",
      message: "시작 버튼을 누르면 3, 2, 1 카운트다운 후 카드 학습이 시작됩니다.",
      subMessage: "현재 카드부터 순서대로 진행합니다.",
    };
  }

  if (phase.mode === "completed") {
    return {
      round: config.repeatCount,
      remainingSeconds: 0,
      status: "완료",
      message: "설정한 세트가 모두 끝났습니다.",
      subMessage: "리셋 후 다시 시작하거나 원하는 카드부터 이어서 학습할 수 있습니다.",
    };
  }

  if (phase.mode === "paused") {
    return {
      round: phase.round,
      remainingSeconds: Math.ceil(phase.remainingMs / 1000),
      status: phase.pausedFrom === "precountdown" ? "시작 전 일시정지" : "일시정지",
      message: "현재 지점에서 멈춰둔 상태입니다.",
      subMessage: "재개를 누르면 같은 세트에서 이어집니다.",
    };
  }

  const remainingSeconds = Math.max(Math.ceil((phase.endsAt - state.now) / 1000), 0);

  if (phase.mode === "precountdown") {
    return {
      round: phase.round,
      remainingSeconds,
      status: "시작 준비",
      message: "곧 현재 카드 학습을 시작합니다.",
      subMessage: "문제를 먼저 떠올릴 준비를 해두면 됩니다.",
    };
  }

  const inAlert = phase.alertStarted && remainingSeconds <= config.alertDuration;
  return {
    round: phase.round,
    remainingSeconds,
    status: inAlert ? "정의/키워드 공개 구간" : "문제 생각 중",
    message: inAlert
      ? "정의와 키워드가 열린 상태입니다. 남은 시간 안에 빠르게 정리해보세요."
      : "문제를 먼저 떠올리다가 공개 구간에서 답을 확인하는 흐름입니다.",
    subMessage: inAlert
      ? "시간이 끝나면 자동으로 다음 카드로 넘어갑니다."
      : `${config.alertDuration}초 전부터 답이 자동 공개됩니다.`,
  };
}

function getOverallRemainingSeconds(display) {
  const config = state.timerConfig;
  const phase = state.timerPhase;

  if (phase.mode === "completed") {
    return 0;
  }

  if (phase.mode === "idle") {
    return config.totalDuration * config.repeatCount;
  }

  if (phase.mode === "paused") {
    const currentRemaining = Math.ceil(phase.remainingMs / 1000);
    const futureRounds = Math.max(config.repeatCount - phase.round, 0);
    const currentRoundSeconds = phase.pausedFrom === "precountdown"
      ? currentRemaining + config.totalDuration
      : currentRemaining;
    return currentRoundSeconds + futureRounds * config.totalDuration;
  }

  if (phase.mode === "precountdown") {
    const futureRounds = Math.max(config.repeatCount - phase.round, 0);
    return display.remainingSeconds + config.totalDuration + futureRounds * config.totalDuration;
  }

  const futureRounds = Math.max(config.repeatCount - display.round, 0);
  return display.remainingSeconds + futureRounds * config.totalDuration;
}

function applyTimerConfigFromInputs() {
  const minimumDuration = runtime.isDesktopWidget ? 0 : 1;
  const nextConfig = {
    totalDuration: clampInput(state.timerInputs.totalDuration, minimumDuration, state.timerConfig.totalDuration),
    alertDuration: clampInput(state.timerInputs.alertDuration, 0, state.timerConfig.alertDuration),
    repeatCount: clampInput(state.timerInputs.repeatCount, 1, state.timerConfig.repeatCount),
  };

  nextConfig.alertDuration = Math.min(nextConfig.alertDuration, nextConfig.totalDuration);
  state.timerConfig = nextConfig;
  state.timerInputs = {
    totalDuration: String(nextConfig.totalDuration),
    alertDuration: String(nextConfig.alertDuration),
    repeatCount: String(nextConfig.repeatCount),
  };

  elements.totalDuration.value = state.timerInputs.totalDuration;
  elements.alertDuration.value = state.timerInputs.alertDuration;
  elements.repeatCount.value = state.timerInputs.repeatCount;
}

function renderCard() {
  const card = getCard();

  if (!card) {
    elements.cardPosition.textContent = "0 / 0";
    elements.cardCategory.textContent = "-";
    elements.cardSource.textContent = "카드를 찾지 못했습니다.";
    elements.questionText.textContent = "조건에 맞는 카드가 없습니다.";
    elements.definitionText.textContent = "";
    elements.keywordsText.textContent = "";
    setPanelVisible(elements.definitionAnswerBlock, false);
    setPanelVisible(elements.keywordsBlock, false);
  } else {
    elements.cardPosition.textContent = `${state.currentIndex + 1} / ${state.filteredCards.length}`;
    elements.cardCategory.textContent = card.category || "-";
    elements.cardSource.textContent = `${card.sourceTitle} · ${card.number}번`;
    elements.questionText.textContent = card.question || "문제가 비어 있습니다.";
    elements.definitionText.textContent = card.definition || "정의가 비어 있습니다.";
    elements.keywordsText.textContent = card.keywords || "키워드가 비어 있습니다.";

    const shouldRevealDefinition = state.alwaysReveal || state.revealDefinition;
    const shouldRevealKeywords = state.alwaysReveal || state.revealKeywords;
    setPanelVisible(elements.definitionAnswerBlock, shouldRevealDefinition);
    setPanelVisible(elements.keywordsBlock, shouldRevealKeywords);
  }

  elements.alwaysRevealToggle.checked = state.alwaysReveal;

  const display = getTimerDisplay();
  elements.cycleProgress.textContent = `${display.round} / ${state.timerConfig.repeatCount}`;
  elements.currentSet.textContent = `${display.round} / ${state.timerConfig.repeatCount}`;
  elements.remainingTime.textContent = formatTime(display.remainingSeconds);
  elements.studyRemainingTime.textContent = formatTime(display.remainingSeconds);
  elements.studyTotalRemainingTime.textContent = formatLongTime(getOverallRemainingSeconds(display));
  elements.configuredTotalTime.textContent = formatLongTime(getConfiguredCycleSeconds(true));
  elements.timerStatus.textContent = display.status;
  elements.timerMessage.textContent = display.message;
  elements.timerSubMessage.textContent = display.subMessage;
  syncWidgetAutoToggleLabel();

  elements.startTimerBtn.disabled = !["idle", "completed"].includes(state.timerPhase.mode);
  elements.pauseTimerBtn.disabled = !["precountdown", "running"].includes(state.timerPhase.mode);
  elements.resumeTimerBtn.disabled = state.timerPhase.mode !== "paused";
  elements.resetTimerBtn.disabled = state.timerPhase.mode === "idle";
}

function startTimerLoop() {
  if (state.timerLoopId) {
    return;
  }

  state.timerLoopId = window.setInterval(() => {
    state.now = Date.now();
    const phase = state.timerPhase;

    if (phase.mode === "idle" || phase.mode === "paused" || phase.mode === "completed") {
      renderCard();
      return;
    }

    if (phase.mode === "precountdown") {
      const remainingSeconds = Math.max(Math.ceil((phase.endsAt - state.now) / 1000), 0);
      if (
        remainingSeconds > 0 &&
        remainingSeconds <= PRE_COUNTDOWN_SECONDS &&
        state.lastSpokenSecond !== 1000 + remainingSeconds
      ) {
        state.lastSpokenSecond = 1000 + remainingSeconds;
        speakNumber(remainingSeconds);
      }

      if (state.now >= phase.endsAt) {
        cancelSpeech();
        resetRevealState();
        state.timerPhase = {
          mode: "running",
          round: phase.round,
          endsAt: state.now + state.timerConfig.totalDuration * 1000,
          alertStarted: false,
        };
      }
      renderCard();
      return;
    }

    const remainingSeconds = Math.max(Math.ceil((phase.endsAt - state.now) / 1000), 0);
    const shouldAlert = remainingSeconds <= state.timerConfig.alertDuration;

    if (
      shouldAlert &&
      remainingSeconds > 0 &&
      remainingSeconds <= state.timerConfig.alertDuration &&
      state.lastSpokenSecond !== remainingSeconds
    ) {
      state.lastSpokenSecond = remainingSeconds;
      speakNumber(remainingSeconds);
    }

    if (shouldAlert && !phase.alertStarted) {
      state.timerPhase = {
        ...phase,
        alertStarted: true,
      };
      revealAll();
      return;
    }

    if (state.now >= phase.endsAt) {
      cancelSpeech();
      if (phase.round < state.timerConfig.repeatCount && state.filteredCards.length > 0) {
        state.currentIndex = (state.currentIndex + 1) % state.filteredCards.length;
        resetRevealState();
        state.timerPhase = {
          mode: "running",
          round: phase.round + 1,
          endsAt: state.now + state.timerConfig.totalDuration * 1000,
          alertStarted: false,
        };
      } else {
        state.timerPhase = {
          mode: "completed",
        };
        stopTimerLoop();
        elements.finishAudio?.play().catch(() => {});
      }
    }

    renderCard();
  }, 100);
}

function handleTimerInputChange(key, value) {
  state.timerInputs = {
    ...state.timerInputs,
    [key]: value,
  };
  if (runtime.isDesktopWidget) {
    applyTimerConfigFromInputs();
    startWidgetAutoAdvance();
  }
  renderCard();
}

function handleStartTimer() {
  if (!state.filteredCards.length) {
    return;
  }

  applyTimerConfigFromInputs();
  stopTimerLoop();
  cancelSpeech();
  if (elements.finishAudio) {
    elements.finishAudio.pause();
    elements.finishAudio.currentTime = 0;
  }

  state.now = Date.now();
  resetRevealState();
  if (!runtime.isDesktopWidget) {
    openStudyMode();
  }
  state.timerPhase = {
    mode: "precountdown",
    round: 1,
    endsAt: state.now + PRE_COUNTDOWN_SECONDS * 1000,
  };
  startTimerLoop();
  renderCard();
}

function handlePauseTimer() {
  const phase = state.timerPhase;
  if (phase.mode !== "precountdown" && phase.mode !== "running") {
    return;
  }

  state.timerPhase = {
    mode: "paused",
    round: phase.round,
    pausedFrom: phase.mode,
    remainingMs: Math.max(phase.endsAt - Date.now(), 0),
    alertStarted: phase.mode === "running" ? phase.alertStarted : false,
  };
  stopTimerLoop();
  cancelSpeech();
  renderCard();
}

function handleResumeTimer() {
  const phase = state.timerPhase;
  if (phase.mode !== "paused") {
    return;
  }

  state.now = Date.now();
  cancelSpeech();
  state.timerPhase = phase.pausedFrom === "precountdown"
    ? {
        mode: "precountdown",
        round: phase.round,
        endsAt: state.now + phase.remainingMs,
      }
    : {
        mode: "running",
        round: phase.round,
        endsAt: state.now + phase.remainingMs,
        alertStarted: phase.alertStarted,
      };
  startTimerLoop();
  renderCard();
}

function handleResetTimer() {
  stopTimerLoop();
  stopWidgetAutoAdvance();
  cancelSpeech();
  state.now = Date.now();
  if (elements.finishAudio) {
    elements.finishAudio.pause();
    elements.finishAudio.currentTime = 0;
  }
  state.timerPhase = {
    mode: "idle",
  };
  if (!runtime.isDesktopWidget) {
    closeStudyMode();
  }
  renderCard();
}

function nextCard() {
  if (!state.filteredCards.length) {
    return;
  }
  state.currentIndex = (state.currentIndex + 1) % state.filteredCards.length;
  if (runtime.isDesktopWidget && state.widgetAutoAdvanceEnabled && state.timerConfig.totalDuration > 0) {
    state.widgetAutoEndsAt = Date.now() + state.timerConfig.totalDuration * 1000;
  }
  resetRevealState();
  resetStudyScroll();
  renderCard();
}

function prevCard() {
  if (!state.filteredCards.length) {
    return;
  }
  state.currentIndex = (state.currentIndex - 1 + state.filteredCards.length) % state.filteredCards.length;
  if (runtime.isDesktopWidget && state.widgetAutoAdvanceEnabled && state.timerConfig.totalDuration > 0) {
    state.widgetAutoEndsAt = Date.now() + state.timerConfig.totalDuration * 1000;
  }
  resetRevealState();
  resetStudyScroll();
  renderCard();
}

function startWidgetAutoAdvance() {
  if (!runtime.isDesktopWidget) {
    return;
  }

  stopWidgetAutoAdvance();
  if (!state.widgetAutoAdvanceEnabled || state.timerConfig.totalDuration <= 0) {
    state.widgetAutoEndsAt = 0;
    renderCard();
    return;
  }
  state.widgetAutoEndsAt = Date.now() + state.timerConfig.totalDuration * 1000;
  state.widgetAutoAdvanceId = window.setInterval(() => {
    if (!state.filteredCards.length) {
      return;
    }

    const remainingMs = state.widgetAutoEndsAt - Date.now();
    if (remainingMs <= 0) {
      state.currentIndex = (state.currentIndex + 1) % state.filteredCards.length;
      resetRevealState();
      playWidgetCue();
      state.widgetAutoEndsAt = Date.now() + state.timerConfig.totalDuration * 1000;
    }
    renderCard();
  }, 250);
}

function revealDefinition() {
  state.revealDefinition = true;
  renderCard();
}

function revealKeywords() {
  state.revealKeywords = true;
  renderCard();
}

function revealAll() {
  state.revealDefinition = true;
  state.revealKeywords = true;
  renderCard();
}

function shuffleCards(list) {
  const clone = [...list];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
  }
  return clone;
}

function applyFilters() {
  const category = elements.categoryFilter.value;
  const baseCards = category === "all"
    ? [...state.cards]
    : state.cards.filter((card) => card.category === category);

  state.filteredCards = elements.shuffleToggle.checked ? shuffleCards(baseCards) : baseCards;
  state.currentIndex = 0;
  resetRevealState();
  if (runtime.isDesktopWidget) {
    renderCard();
    startWidgetAutoAdvance();
    return;
  }
  handleResetTimer();
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
  elements.totalDuration.addEventListener("input", (event) => handleTimerInputChange("totalDuration", event.target.value));
  elements.alertDuration.addEventListener("input", (event) => handleTimerInputChange("alertDuration", event.target.value));
  elements.repeatCount.addEventListener("input", (event) => handleTimerInputChange("repeatCount", event.target.value));
  elements.spokenEnabled.addEventListener("change", (event) => {
    state.spokenEnabled = event.target.checked;
    if (!state.spokenEnabled) {
      cancelSpeech();
    }
    renderCard();
  });
  elements.alwaysRevealToggle.addEventListener("change", (event) => {
    state.alwaysReveal = event.target.checked;
    renderCard();
  });
  elements.startTimerBtn.addEventListener("click", handleStartTimer);
  elements.pauseTimerBtn.addEventListener("click", handlePauseTimer);
  elements.resumeTimerBtn.addEventListener("click", handleResumeTimer);
  elements.resetTimerBtn.addEventListener("click", handleResetTimer);
  elements.closeStudyBtn?.addEventListener("click", () => {
    if (runtime.isDesktopWidget && window.beepbeepDesktop?.minimize) {
      window.beepbeepDesktop.minimize();
      return;
    }
    closeStudyMode();
  });
  elements.studyBackdrop?.addEventListener("click", closeStudyMode);
  elements.showDefinitionBtn.addEventListener("click", revealDefinition);
  elements.showKeywordsBtn.addEventListener("click", revealKeywords);
  elements.showAllBtn.addEventListener("click", revealAll);
  elements.widgetTimerSeconds?.addEventListener("input", (event) => {
    handleTimerInputChange("totalDuration", event.target.value);
  });
  elements.widgetAutoToggleBtn?.addEventListener("click", () => {
    state.widgetAutoAdvanceEnabled = !state.widgetAutoAdvanceEnabled;
    syncWidgetAutoToggleLabel();
    startWidgetAutoAdvance();
  });
  elements.prevBtn.addEventListener("click", () => {
    prevCard();
    startWidgetAutoAdvance();
  });
  elements.nextBtn.addEventListener("click", () => {
    nextCard();
    startWidgetAutoAdvance();
  });

  window.beepbeepDesktop?.onSettingsChanged?.((settings) => {
    applyDesktopWidgetSettings(settings);
  });

  window.addEventListener("resize", syncWidgetLayout);
  window.addEventListener("resize", syncMobileStudyLayout);

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

    if (event.key === "ArrowLeft") {
      prevCard();
    }

    if (event.key.toLowerCase() === "s") {
      handleStartTimer();
    }

    if (event.key.toLowerCase() === "r") {
      handleResetTimer();
    }

    if (event.key === "Escape" && state.studyMode) {
      closeStudyMode();
    }
  });

  document.addEventListener("mousedown", (event) => {
    if (!runtime.isDesktopWidget) {
      return;
    }

    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    const selection = window.getSelection();
    if (selection && selection.type === "Range") {
      selection.removeAllRanges();
    }
  });
}

async function init() {
  const response = await fetch("./data/cards.json", { cache: "no-store" });
  state.cards = await response.json();
  setupCategoryOptions(state.cards);
  state.filteredCards = elements.shuffleToggle.checked ? shuffleCards([...state.cards]) : [...state.cards];
  bindEvents();
  if (runtime.isDesktopWidget) {
    state.alwaysReveal = true;
    state.revealDefinition = true;
    state.revealKeywords = true;
    elements.alwaysRevealToggle.checked = true;
    applyTimerConfigFromInputs();
    syncWidgetLayout();
    startWidgetAutoAdvance();
  }
  renderCard();
}

init().catch((error) => {
  console.error(error);
  elements.questionText.textContent = "카드 데이터를 불러오지 못했습니다.";
  elements.cardSource.textContent = "data/cards.json 확인 필요";
});






