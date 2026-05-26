const SAMPLE_CODE = `int a;
int b;
a = 5;
c = a + b;
`;

const DEBOUNCE_MS = 400;
const ANALYZER_SOURCE = "static-analyzer";

let editor = null;
let analyzeTimer = null;
let latestRequestId = 0;
let latestDiagnostics = [];
let latestATS = null;
let activeProblemFilter = "all";
let isRawExpanded = false;

const analysisStatus = document.getElementById("analysis-status");
const problemsList = document.getElementById("problems-list");
const output = document.getElementById("output");
const errorCountEl = document.getElementById("error-count");
const warningCountEl = document.getElementById("warning-count");
const atsBadge = document.getElementById("ats-badge");
const loadSampleBtn = document.getElementById("load-sample");
const atsRing = document.getElementById("ats-score-ring-fill");
const atsScoreNumber = document.getElementById("ats-score-number");
const atsRatingLabel = document.getElementById("ats-rating-label");
const atsErrorBar = document.getElementById("ats-error-bar");
const atsWarningBar = document.getElementById("ats-warning-bar");
const atsErrorCountLabel = document.getElementById("ats-error-count-label");
const atsWarningCountLabel = document.getElementById("ats-warning-count-label");
const toggleRawBtn = document.getElementById("toggle-raw-report");
const errorBarRow = document.getElementById("ats-error-bar-row");
const warningBarRow = document.getElementById("ats-warning-bar-row");

const RING_CIRCUMFERENCE = 2 * Math.PI * 48;

function setStatus(text, state) {
  analysisStatus.textContent = text;
  analysisStatus.className = `status-${state}`;
}

function formatOutput(text) {
  const lines = text.split("\n");
  let formatted = "";

  lines.forEach((line) => {
    if (line.includes("Error")) {
      formatted += `<div class="error">${escapeHtml(line)}</div>`;
    } else if (line.includes("Warning")) {
      formatted += `<div class="warning">${escapeHtml(line)}</div>`;
    } else if (line.includes("ATS Score")) {
      formatted += `<div class="score">${escapeHtml(line)}</div>`;
    } else if (line.includes("Rating")) {
      formatted += `<div class="success">${escapeHtml(line)}</div>`;
    } else if (line.includes("====")) {
      formatted += `<div class="section">${escapeHtml(line)}</div>`;
    } else {
      formatted += `<div>${escapeHtml(line)}</div>`;
    }
  });

  return formatted;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function severityToMonaco(severity) {
  if (severity === "error") return monaco.MarkerSeverity.Error;
  if (severity === "warning") return monaco.MarkerSeverity.Warning;
  return monaco.MarkerSeverity.Info;
}

function applyDiagnostics(diagnostics) {
  if (!editor) return;

  const model = editor.getModel();
  const markers = diagnostics.map((d) => ({
    startLineNumber: d.line,
    startColumn: d.startColumn,
    endLineNumber: d.line,
    endColumn: d.endColumn,
    message: d.message,
    severity: severityToMonaco(d.severity),
    source: ANALYZER_SOURCE,
  }));

  monaco.editor.setModelMarkers(model, ANALYZER_SOURCE, markers);
}

function renderProblemsList(diagnostics) {
  const filteredDiagnostics =
    activeProblemFilter === "all"
      ? diagnostics
      : diagnostics.filter((d) => d.severity === activeProblemFilter);

  if (!filteredDiagnostics.length) {
    const label =
      activeProblemFilter === "all"
        ? "No issues detected."
        : `No ${activeProblemFilter}s detected.`;
    problemsList.innerHTML =
      `<li class="problems-empty">${label}</li>`;
    return;
  }

  problemsList.innerHTML = filteredDiagnostics
    .map(
      (d, index) => `
      <li class="problem-item ${d.severity}" data-index="${index}">
        <span class="problem-icon">${d.severity === "error" ? "✕" : "⚠"}</span>
        <span class="problem-location">Line ${d.line}</span>
        <span class="problem-message">${escapeHtml(d.message)}</span>
      </li>`
    )
    .join("");

  problemsList.querySelectorAll(".problem-item").forEach((item) => {
    item.addEventListener("click", () => {
      const index = Number(item.dataset.index);
      const diagnostic = filteredDiagnostics[index];
      if (!diagnostic || !editor) return;

      editor.revealLineInCenter(diagnostic.line);
      editor.setPosition({
        lineNumber: diagnostic.line,
        column: diagnostic.startColumn,
      });
      editor.focus();
    });
  });
}

function getRatingColor(score) {
  if (score >= 90) return "#22c55e";
  if (score >= 75) return "#00d9ff";
  if (score >= 60) return "#facc15";
  if (score >= 40) return "#fb923c";
  return "#f85149";
}

function updateATSDashboard(diagnostics, ats) {
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;

  const safeScore =
    ats && typeof ats.score === "number"
      ? Math.max(0, Math.min(100, ats.score))
      : null;

  if (safeScore === null) {
    atsScoreNumber.textContent = "--";
    atsRatingLabel.textContent = "No data yet";
    atsRing.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
    atsRing.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
    atsRing.style.stroke = "#00d9ff";
  } else {
    const offset = RING_CIRCUMFERENCE * (1 - safeScore / 100);
    atsScoreNumber.textContent = String(safeScore);
    atsRatingLabel.textContent = ats?.rating || "Unknown";
    atsRing.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
    atsRing.style.strokeDashoffset = `${offset}`;
    atsRing.style.stroke = getRatingColor(safeScore);
  }

  const maxImpact = 100;
  const errorImpact = Math.min(errors * 15, maxImpact);
  const warningImpact = Math.min(warnings * 5, maxImpact);

  atsErrorBar.style.width = `${errorImpact}%`;
  atsWarningBar.style.width = `${warningImpact}%`;
  atsErrorCountLabel.textContent = String(errors);
  atsWarningCountLabel.textContent = String(warnings);
}

function setProblemFilter(filter) {
  activeProblemFilter = filter;
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  renderProblemsList(latestDiagnostics);
}

function attachATSInteractions() {
  if (toggleRawBtn) {
    toggleRawBtn.addEventListener("click", () => {
      isRawExpanded = !isRawExpanded;
      output.classList.toggle("ats-raw-output-expanded", isRawExpanded);
      output.classList.toggle("ats-raw-output-collapsed", !isRawExpanded);
      toggleRawBtn.textContent = isRawExpanded ? "Hide raw text" : "Show raw text";
    });
  }

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setProblemFilter(btn.dataset.filter);
    });
  });

  const activateWithKeyboard = (event, callback) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  };

  if (errorBarRow) {
    errorBarRow.addEventListener("click", () => setProblemFilter("error"));
    errorBarRow.addEventListener("keydown", (event) =>
      activateWithKeyboard(event, () => setProblemFilter("error"))
    );
  }

  if (warningBarRow) {
    warningBarRow.addEventListener("click", () => setProblemFilter("warning"));
    warningBarRow.addEventListener("keydown", (event) =>
      activateWithKeyboard(event, () => setProblemFilter("warning"))
    );
  }
}

function updateStatusBar(diagnostics, ats) {
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;

  errorCountEl.textContent = `${errors} error${errors === 1 ? "" : "s"}`;
  warningCountEl.textContent = `${warnings} warning${warnings === 1 ? "" : "s"}`;

  if (ats && ats.score !== null) {
    atsBadge.textContent = `ATS: ${ats.score}/100 (${ats.rating || "—"})`;
  } else {
    atsBadge.textContent = "ATS: —";
  }
}

async function analyzeCode(code) {
  const requestId = ++latestRequestId;

  if (!code.trim()) {
    applyDiagnostics([]);
    latestDiagnostics = [];
    latestATS = null;
    renderProblemsList(latestDiagnostics);
    updateATSDashboard(latestDiagnostics, latestATS);
    updateStatusBar([], null);
    output.innerHTML = "";
    setStatus("Ready", "idle");
    return;
  }

  setStatus("Analyzing…", "busy");

  try {
    const res = await fetch("/analyze/json", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: code,
    });

    if (requestId !== latestRequestId) return;

    const data = await res.json();

    if (!res.ok) {
      setStatus("Error", "error");
      problemsList.innerHTML = `<li class="problems-empty error">${escapeHtml(
        data.error || "Analysis failed."
      )}</li>`;
      return;
    }

    applyDiagnostics(data.diagnostics || []);
    latestDiagnostics = data.diagnostics || [];
    latestATS = data.ats || {};
    renderProblemsList(latestDiagnostics);
    updateATSDashboard(latestDiagnostics, latestATS);
    updateStatusBar(latestDiagnostics, latestATS);
    output.innerHTML = formatOutput(data.raw || "");

    const errorCount = (data.diagnostics || []).filter(
      (d) => d.severity === "error"
    ).length;
    setStatus(errorCount ? `${errorCount} issue(s)` : "No issues", "done");
  } catch (err) {
    if (requestId !== latestRequestId) return;
    setStatus("Offline", "error");
    problemsList.innerHTML =
      '<li class="problems-empty error">Could not reach server. Run: python server.py</li>';
  }
}

function scheduleAnalysis() {
  if (!editor) return;

  clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(() => {
    analyzeCode(editor.getValue());
  }, DEBOUNCE_MS);
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(`${target}-panel`).classList.add("active");
    });
  });
}

function initMonaco() {
  require.config({
    paths: {
      vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
    },
  });

  require(["vs/editor/editor.main"], () => {
    editor = monaco.editor.create(document.getElementById("editor"), {
      value: "",
      language: "c",
      theme: "vs-dark",
      fontSize: 14,
      fontFamily: "Consolas, Monaco, monospace",
      lineNumbers: "on",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      renderValidationDecorations: "on",
      glyphMargin: true,
      folding: false,
      wordWrap: "on",
      padding: { top: 12, bottom: 12 },
    });

    editor.onDidChangeModelContent(() => {
      scheduleAnalysis();
    });

    loadSampleBtn.addEventListener("click", () => {
      editor.setValue(SAMPLE_CODE);
      editor.focus();
    });

    initTabs();
    attachATSInteractions();
    setProblemFilter("all");
    updateATSDashboard([], null);
    setStatus("Ready", "idle");
  });
}

initMonaco();
