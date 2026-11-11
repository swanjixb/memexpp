"use strict";

(() => {
  const WORD_LISTS = [
    ["apple", "ladder", "candle", "rabbit", "hammer", "garden"],
    ["bottle", "bridge", "lemon", "pillow", "turtle", "window"],
    ["basket", "cloud", "pencil", "monkey", "guitar", "button"]
  ];

  const STRATEGIES = [
    {
      id: "maintenance_rehearsal",
      name: "Maintenance rehearsal",
      instructions: "As soon as each word appears, silently repeat that word to yourself over and over while it remains on the screen. Keep repeating the word itself. When the next word appears, stop repeating the previous word and begin repeating the new one. Do not deliberately make a mental picture or think about how the word relates to your own life."
    },
    {
      id: "self_reference",
      name: "Self-reference",
      instructions: "As soon as each word appears, silently consider how the object or thing relates to you personally. You might consider whether you have used it, owned it, seen it, encountered it, liked it, disliked it, or had an experience involving it. Make a personal connection for that word while it is on the screen. When the next word appears, make a new personal connection for that word."
    },
    {
      id: "mental_imagery",
      name: "Mental imagery",
      instructions: "As soon as each word appears, form a mental picture of the object or thing. Try to picture its appearance, such as its shape, color, size, or texture. Keep your attention on the imagined picture while the word is on the screen. When the next word appears, form a new picture for that word. Focus on visualizing rather than repeating the word or connecting it to your personal life."
    }
  ];

  const $ = (id) => document.getElementById(id);
  const screens = ["welcome-screen", "instruction-screen", "study-screen", "between-screen", "distractor-screen", "recall-transition-screen", "recall-screen", "results-screen"];
  const state = {
    sessionId: "",
    startedAt: "",
    displayMs: 3000,
    strategies: [],
    assignments: {},
    trials: [],
    currentBlock: 0,
    currentWord: 0,
    distractorStart: 0,
    distractorExpected: null,
    distractorResponses: [],
    distractorStarted: false,
    recallRaw: "",
    recallMatches: [],
    timers: []
  };

  function showScreen(id) {
    screens.forEach(screen => $(screen).classList.toggle("hidden", screen !== id));
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function makeId() {
    return "S" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function clearTimers() {
    state.timers.forEach(clearInterval);
    state.timers = [];
  }

  function beginSession() {
    const seconds = Number($("display-duration").value);
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 10) {
      alert("Choose a word display duration from 1 to 10 seconds.");
      return;
    }
    state.sessionId = makeId();
    state.startedAt = new Date().toISOString();
    state.displayMs = seconds * 1000;
    state.strategies = shuffle(STRATEGIES);
    const lists = shuffle([0, 1, 2]);
    state.assignments = {};
    state.strategies.forEach((strategy, index) => {
      state.assignments[strategy.id] = lists[index];
    });
    state.trials = [];
    state.strategies.forEach((strategy, blockIndex) => {
      const words = WORD_LISTS[state.assignments[strategy.id]];
      words.forEach((word, wordIndex) => {
        state.trials.push({
          session_id: state.sessionId,
          block_order: blockIndex + 1,
          strategy_id: strategy.id,
          strategy: strategy.name,
          list_id: state.assignments[strategy.id] + 1,
          word_order_in_block: wordIndex + 1,
          overall_study_order: blockIndex * 6 + wordIndex + 1,
          word,
          recalled: false,
          matched_response: "",
          scoring_method: ""
        });
      });
    });
    state.currentBlock = 0;
    state.currentWord = 0;
    state.distractorResponses = [];
    state.distractorStarted = false;
    state.recallRaw = "";
    showInstruction();
  }

  function showInstruction() {
    const strategy = state.strategies[state.currentBlock];
    $("block-count").textContent = `BLOCK ${state.currentBlock + 1} OF 3`;
    $("strategy-title").textContent = strategy.name;
    $("strategy-instructions").textContent = strategy.instructions;
    $("start-block-button").textContent = `Begin block ${state.currentBlock + 1}`;
    showScreen("instruction-screen");
  }

  function startBlock() {
    state.currentWord = 0;
    showScreen("study-screen");
    showWord();
  }

  function showWord() {
    const strategy = state.strategies[state.currentBlock];
    const words = WORD_LISTS[state.assignments[strategy.id]];
    if (state.currentWord >= words.length) {
      finishBlock();
      return;
    }
    const word = words[state.currentWord];
    const elapsedStart = performance.now();
    $("stimulus-word").textContent = word;
    $("study-progress-label").textContent = `Block ${state.currentBlock + 1} · Word ${state.currentWord + 1} of 6`;
    $("study-progress").style.width = "0%";
    clearTimers();
    const timer = setInterval(() => {
      const elapsed = performance.now() - elapsedStart;
      const remaining = Math.max(0, state.displayMs - elapsed);
      $("study-countdown").textContent = `${(remaining / 1000).toFixed(1)} s`;
      $("study-progress").style.width = `${Math.min(100, elapsed / state.displayMs * 100)}%`;
      if (elapsed >= state.displayMs) {
        clearInterval(timer);
        state.timers = [];
        state.currentWord++;
        showWord();
      }
    }, 50);
    state.timers.push(timer);
  }

  function finishBlock() {
    clearTimers();
    const completedStrategy = state.strategies[state.currentBlock].name;
    $("between-step-label").textContent = `STUDY PROGRESS · ${state.currentBlock + 1} OF 3 BLOCKS COMPLETE`;
    $("between-title").textContent = state.currentBlock < 2 ? "This block is complete" : "All study blocks are complete";
    $("between-message").textContent = `You have finished all six words in the ${completedStrategy} block.`;
    if (state.currentBlock < 2) {
      const nextStrategy = state.strategies[state.currentBlock + 1].name;
      $("next-step-instruction").textContent = `Select Continue to read the instructions for the next strategy: ${nextStrategy}. Do not try to review or recall the words from this block.`;
      $("continue-button").textContent = "Continue to next block";
    } else {
      $("next-step-instruction").textContent = "Select Continue to begin the 30-second counting task. A three-digit starting number and the instructions will appear on the next screen.";
      $("continue-button").textContent = "Continue to counting task";
    }
    showScreen("between-screen");
  }

  function prepareDistractor() {
    state.distractorStart = Math.floor(Math.random() * 900) + 100;
    state.distractorExpected = state.distractorStart - 3;
    state.distractorResponses = [];
    state.distractorStarted = false;
    $("starting-number").textContent = state.distractorStart;
    $("distractor-timer").textContent = "30";
    $("distractor-feedback").textContent = "Press Start when you are ready.";
    $("distractor-input").value = "";
    $("distractor-input").disabled = true;
    $("submit-distractor").disabled = true;
    $("start-distractor").disabled = false;
    showScreen("distractor-screen");
  }

  function startDistractor() {
    if (state.distractorStarted) return;
    state.distractorStarted = true;
    $("start-distractor").disabled = true;
    $("distractor-input").disabled = false;
    $("submit-distractor").disabled = false;
    $("distractor-input").focus();
    const start = Date.now();
    const timer = setInterval(() => {
      const remaining = Math.max(0, 30 - Math.floor((Date.now() - start) / 1000));
      $("distractor-timer").textContent = String(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        state.timers = [];
        $("distractor-input").disabled = true;
        $("submit-distractor").disabled = true;
        $("distractor-feedback").textContent = `Time is up. You entered ${state.distractorResponses.length} responses.`;
        const transition = setTimeout(() => {
          showScreen("recall-transition-screen");
        }, 900);
        state.timers.push(transition);
      }
    }, 100);
    state.timers.push(timer);
  }

  function submitDistractor() {
    if (!state.distractorStarted || $("distractor-input").disabled) return;
    const raw = $("distractor-input").value.trim();
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isInteger(value)) return;
    const expected = state.distractorExpected;
    const correct = value === expected;
    state.distractorResponses.push({
      response_number: state.distractorResponses.length + 1,
      response: value,
      expected,
      correct,
      elapsed_seconds: Math.round((Date.now() - state.distractorStartedAt) / 1000)
    });
    state.distractorExpected = value - 3;
    $("distractor-feedback").textContent = correct ? "Recorded." : "Recorded. Keep subtracting 3 from your last answer.";
    $("distractor-input").value = "";
    $("distractor-input").focus();
  }

  function normalize(value) {
    return String(value).toLocaleLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function editDistance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = old;
      }
    }
    return row[b.length];
  }

  function tokenizeRecall(raw) {
    return raw.split(/[\s,;]+/).map(token => token.trim()).filter(Boolean);
  }

  function scoreRecall() {
    const tokens = tokenizeRecall(state.recallRaw);
    const usedTrials = new Set();
    const matches = [];
    const normalizedWords = state.trials.map((trial, index) => ({
      index,
      word: trial.word,
      normalized: normalize(trial.word)
    }));

    tokens.forEach(token => {
      const candidate = normalize(token);
      if (!candidate) return;
      let possible = normalizedWords.filter(item => !usedTrials.has(item.index) && item.normalized === candidate);
      let method = "exact";
      if (possible.length === 0) {
        const distances = normalizedWords
          .filter(item => !usedTrials.has(item.index))
          .map(item => ({ ...item, distance: editDistance(candidate, item.normalized) }))
          .filter(item => {
            const limit = item.normalized.length >= 8 ? 2 : 1;
            return item.distance > 0 && item.distance <= limit;
          })
          .sort((a, b) => a.distance - b.distance);
        if (distances.length && (distances.length === 1 || distances[0].distance < distances[1].distance)) {
          possible = [distances[0]];
          method = "spelling_tolerant";
        }
      }
      if (possible.length === 1) {
        const match = possible[0];
        usedTrials.add(match.index);
        state.trials[match.index].recalled = true;
        state.trials[match.index].matched_response = token;
        state.trials[match.index].scoring_method = method;
        matches.push({ response: token, word: match.word, method, strategy: state.trials[match.index].strategy });
      }
    });
    state.recallMatches = matches;
  }

  function escapeCsv(value) {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadCsv(filename, rows, columns) {
    const lines = [
      columns.map(column => escapeCsv(column.label)).join(","),
      ...rows.map(row => columns.map(column => escapeCsv(row[column.key])).join(","))
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function buildResults() {
    const summaries = state.strategies.map(strategy => {
      const trials = state.trials.filter(trial => trial.strategy_id === strategy.id);
      const recalled = trials.filter(trial => trial.recalled).length;
      return {
        strategy: strategy.name,
        strategy_id: strategy.id,
        block_order: state.strategies.indexOf(strategy) + 1,
        list_id: state.assignments[strategy.id] + 1,
        recalled,
        total: trials.length,
        proportion: (recalled / trials.length).toFixed(4),
        recalled_words: trials.filter(trial => trial.recalled).map(trial => trial.word).join("; "),
        missed_words: trials.filter(trial => !trial.recalled).map(trial => trial.word).join("; ")
      };
    });
    const totalRecalled = state.trials.filter(trial => trial.recalled).length;
    $("session-meta").textContent = `Session ${state.sessionId} · ${new Date(state.startedAt).toLocaleString()} · ${totalRecalled}/18 words recalled`;
    $("score-cards").innerHTML = "";
    summaries.forEach(summary => {
      const card = document.createElement("div");
      card.className = "score-card";
      const strategy = document.createElement("div");
      strategy.className = "strategy";
      strategy.textContent = summary.strategy;
      const score = document.createElement("div");
      score.className = "score";
      score.textContent = `${summary.recalled}/6`;
      const pct = document.createElement("div");
      pct.className = "small muted";
      pct.textContent = `${Math.round(Number(summary.proportion) * 100)}% recalled`;
      card.append(strategy, score, pct);
      $("score-cards").append(card);
    });
    $("results-table").innerHTML = "";
    summaries.forEach(summary => {
      const row = document.createElement("tr");
      [summary.strategy, `${summary.recalled}/6`, `${Math.round(Number(summary.proportion) * 100)}%`, summary.recalled_words || "—"].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      $("results-table").append(row);
    });

    const common = {
      session_id: state.sessionId,
      session_started_at: state.startedAt,
      session_completed_at: new Date().toISOString(),
      word_display_seconds: state.displayMs / 1000,
      distractor_start_number: state.distractorStart,
      distractor_response_count: state.distractorResponses.length,
      distractor_correct_count: state.distractorResponses.filter(item => item.correct).length,
      raw_recall_response: state.recallRaw,
      total_recalled: totalRecalled,
      total_studied: 18
    };
    const oneSessionRow = { ...common };
    summaries.forEach((summary, index) => {
      const prefix = summary.strategy_id;
      oneSessionRow[`${prefix}_block_order`] = summary.block_order;
      oneSessionRow[`${prefix}_list_id`] = summary.list_id;
      oneSessionRow[`${prefix}_recalled_count`] = summary.recalled;
      oneSessionRow[`${prefix}_words_in_strategy`] = summary.total;
      oneSessionRow[`${prefix}_recall_proportion`] = summary.proportion;
      oneSessionRow[`${prefix}_recalled_words`] = summary.recalled_words;
      oneSessionRow[`${prefix}_missed_words`] = summary.missed_words;
    });
    state.summaryRows = [oneSessionRow];
    showScreen("results-screen");
  }

  function submitRecall() {
    state.recallRaw = $("recall-response").value;
    scoreRecall();
    buildResults();
  }

  $("begin-button").addEventListener("click", beginSession);
  $("start-block-button").addEventListener("click", startBlock);
  $("continue-button").addEventListener("click", () => {
    if (state.currentBlock < 2) {
      state.currentBlock++;
      showInstruction();
    } else {
      prepareDistractor();
    }
  });
  $("proceed-recall").addEventListener("click", () => {
    $("recall-response").value = "";
    showScreen("recall-screen");
    $("recall-response").focus();
  });
  $("start-distractor").addEventListener("click", startDistractor);
  $("submit-distractor").addEventListener("click", submitDistractor);
  $("distractor-input").addEventListener("keydown", event => {
    if (event.key === "Enter") submitDistractor();
  });
  $("submit-recall").addEventListener("click", submitRecall);
  $("download-summary").addEventListener("click", () => {
    const row = state.summaryRows[0];
    const columns = [
      ["session_id", "session_id"],
      ["session_started_at", "session_started_at"],
      ["session_completed_at", "session_completed_at"],
      ["word_display_seconds", "word_display_seconds"],
      ["distractor_start_number", "distractor_start_number"],
      ["distractor_response_count", "distractor_response_count"],
      ["distractor_correct_count", "distractor_correct_count"],
      ["raw_recall_response", "raw_recall_response"],
      ["total_recalled", "total_recalled"],
      ["total_studied", "total_studied"]
    ];
    ["maintenance_rehearsal", "self_reference", "mental_imagery"].forEach(prefix => {
      [
        ["block_order", "block_order"],
        ["list_id", "list_id"],
        ["recalled_count", "recalled_count"],
        ["words_in_strategy", "words_in_strategy"],
        ["recall_proportion", "recall_proportion"],
        ["recalled_words", "recalled_words"],
        ["missed_words", "missed_words"]
      ].forEach(([suffix, label]) => columns.push([`${prefix}_${suffix}`, `${prefix}_${label}`]));
    });
    downloadCsv(`encoding_summary_${state.sessionId}.csv`, [row],
      columns.map(([key, label]) => ({ key, label })));
  });
  $("download-trials").addEventListener("click", () => {
    downloadCsv(`encoding_trials_${state.sessionId}.csv`, state.trials.map(trial => ({
      ...trial,
      distractor_start_number: state.distractorStart,
      distractor_response_count: state.distractorResponses.length
    })), [
      { key: "session_id", label: "session_id" },
      { key: "block_order", label: "block_order" },
      { key: "strategy_id", label: "strategy_id" },
      { key: "strategy", label: "strategy" },
      { key: "list_id", label: "list_id" },
      { key: "word_order_in_block", label: "word_order_in_block" },
      { key: "overall_study_order", label: "overall_study_order" },
      { key: "word", label: "studied_word" },
      { key: "recalled", label: "recalled" },
      { key: "matched_response", label: "matched_response" },
      { key: "scoring_method", label: "scoring_method" },
      { key: "distractor_start_number", label: "distractor_start_number" },
      { key: "distractor_response_count", label: "distractor_response_count" }
    ]);
  });
  $("new-session").addEventListener("click", () => {
    clearTimers();
    $("display-duration").value = String(state.displayMs / 1000);
    showScreen("welcome-screen");
  });

  // Capture the time origin for the distractor response log.
  $("start-distractor").addEventListener("click", () => {
    state.distractorStartedAt = Date.now();
  }, { once: false });
})();
