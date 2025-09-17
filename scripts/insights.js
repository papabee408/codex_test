const DATASET_PRIORITY = [
  "insightsImportedEntries",
  "journalEntries",
  "wellnessEntries",
  "dailyEntries",
  "entries",
  "records"
];

const INTERNAL_KEYS = new Set([
  "insightsMemos",
  "insightsImportedEntries"
]);

const DATE_FORMATTER = new Intl.DateTimeFormat("ko", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const state = {
  datasets: new Map(),
  datasetOrder: [],
  activeKey: null,
  entries: [],
  filteredEntries: [],
  charts: {
    satisfaction: null,
    todo: null,
    cumulative: null,
  },
  calendarCursor: new Date(),
};

document.addEventListener("DOMContentLoaded", () => {
  initializeDatasets();
  setupEventListeners();
  setDefaultFilters();
  applyFilters();
  initializeMemoBoard();
});

function initializeDatasets() {
  state.datasets.clear();
  state.datasetOrder = [];

  const detected = detectDatasets();
  for (const dataset of detected) {
    registerDataset(dataset);
  }

  if (!state.datasets.size) {
    const sample = getSampleDataset();
    registerDataset(sample);
    state.activeKey = sample.key;
  } else {
    const preferred = DATASET_PRIORITY.find((key) => state.datasets.has(key));
    state.activeKey = preferred ?? state.datasetOrder[0];
  }

  populateDatasetSelect();
}

function detectDatasets() {
  const results = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || INTERNAL_KEYS.has(key)) continue;

    const rawValue = localStorage.getItem(key);
    if (!rawValue) continue;

    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed) && parsed.length && parsed.some(isRecordLike)) {
        results.push({
          key,
          label: `${key} (${parsed.length.toLocaleString("ko-KR")}개)`,
          entries: parsed,
          source: "localStorage",
        });
      }
    } catch (error) {
      continue; // ignore malformed JSON
    }
  }

  const importedRaw = localStorage.getItem("insightsImportedEntries");
  if (importedRaw) {
    try {
      const parsed = JSON.parse(importedRaw);
      if (Array.isArray(parsed) && parsed.some(isRecordLike)) {
        results.unshift({
          key: "insightsImportedEntries",
          label: `불러온 JSON (${parsed.length.toLocaleString("ko-KR")}개)`,
          entries: parsed,
          source: "imported",
        });
      }
    } catch (_) {
      // ignore import errors silently
    }
  }

  results.sort((a, b) => {
    const priorityA = DATASET_PRIORITY.indexOf(a.key);
    const priorityB = DATASET_PRIORITY.indexOf(b.key);
    const weightA = priorityA === -1 ? DATASET_PRIORITY.length : priorityA;
    const weightB = priorityB === -1 ? DATASET_PRIORITY.length : priorityB;
    return weightA - weightB;
  });

  return results;
}

function registerDataset(dataset) {
  const normalizedEntries = normalizeEntries(dataset.entries);
  const payload = {
    ...dataset,
    entries: normalizedEntries,
  };

  if (!state.datasets.has(dataset.key)) {
    state.datasetOrder.push(dataset.key);
  }

  state.datasets.set(dataset.key, payload);
}

function populateDatasetSelect() {
  const select = document.getElementById("dataset-select");
  select.innerHTML = "";

  for (const key of state.datasetOrder) {
    const option = document.createElement("option");
    const dataset = state.datasets.get(key);
    option.value = key;
    option.textContent = dataset?.label ?? key;
    if (key === state.activeKey) {
      option.selected = true;
    }
    select.append(option);
  }

  if (!state.datasetOrder.includes("sample")) {
    const option = document.createElement("option");
    option.value = "sample";
    option.textContent = "샘플 데이터 (체험용)";
    select.append(option);
  }
}

function setDefaultFilters() {
  const dataset = getActiveDataset();
  const entries = dataset?.entries ?? [];
  if (!entries.length) return;

  const firstDate = entries[0].date;
  const lastDate = entries[entries.length - 1].date;
  const fromInput = document.getElementById("from-date");
  const toInput = document.getElementById("to-date");

  fromInput.value = toISODate(firstDate);
  toInput.value = toISODate(lastDate);
}

function setupEventListeners() {
  document.getElementById("apply-filter").addEventListener("click", applyFilters);
  document.getElementById("reset-filter").addEventListener("click", () => {
    setDefaultFilters();
    applyFilters();
  });

  document
    .getElementById("dataset-select")
    .addEventListener("change", (event) => {
      const value = event.target.value;
      if (value === "sample") {
        const sample = getSampleDataset();
        registerDataset(sample);
        state.activeKey = sample.key;
      } else {
        state.activeKey = value;
      }
      setDefaultFilters();
      applyFilters();
    });

  document.getElementById("refresh-button").addEventListener("click", () => {
    initializeDatasets();
    setDefaultFilters();
    applyFilters();
  });

  document
    .getElementById("file-import")
    .addEventListener("change", handleFileImport);

  document
    .getElementById("gratitude-search")
    .addEventListener("input", renderGratitudeSection);

  document
    .getElementById("gratitude-sort")
    .addEventListener("change", renderGratitudeSection);

  document
    .getElementById("export-button")
    .addEventListener("click", handleExport);
}

function applyFilters() {
  const dataset = getActiveDataset();
  const helper = document.getElementById("data-hint");
  const sourceLabel = document.getElementById("data-source-label");

  if (!dataset) {
    state.entries = [];
    state.filteredEntries = [];
    helper.textContent =
      "데이터가 없습니다. JSON 파일을 불러오거나 기존 앱에서 기록을 작성해 보세요.";
    sourceLabel.textContent = "데이터 없음";
    sourceLabel.classList.add("warning");
    renderAll();
    return;
  }

  sourceLabel.textContent = dataset.source === "imported" ? "불러온 JSON" : "로컬 저장소";
  sourceLabel.classList.toggle("warning", dataset.source === "imported");

  helper.textContent =
    dataset.source === "imported"
      ? "이 페이지에서만 사용하는 임시 데이터입니다. 새로고침 후에도 유지하려면 다시 불러와야 해요."
      : `localStorage의 \`${dataset.key}\` 키에서 데이터를 읽어옵니다.`;

  state.entries = dataset.entries;

  const fromValue = document.getElementById("from-date").value;
  const toValue = document.getElementById("to-date").value;

  let filtered = [...state.entries];
  if (fromValue) {
    const fromDate = new Date(fromValue);
    filtered = filtered.filter((entry) => entry.date >= fromDate);
  }
  if (toValue) {
    const toDate = new Date(toValue);
    toDate.setHours(23, 59, 59, 999);
    filtered = filtered.filter((entry) => entry.date <= toDate);
  }

  state.filteredEntries = filtered;
  renderAll();
}

function getActiveDataset() {
  if (!state.activeKey) return null;
  if (state.activeKey === "sample" && !state.datasets.has("sample")) {
    const sample = getSampleDataset();
    registerDataset(sample);
  }
  return state.datasets.get(state.activeKey) ?? null;
}

function renderAll() {
  updateEmptyState();
  updateSummary();
  renderCharts();
  renderGratitudeSection();
  renderTable();
}

function updateEmptyState() {
  const emptySection = document.getElementById("empty-state");
  emptySection.hidden = state.filteredEntries.length > 0;
}

function updateSummary() {
  const grid = document.getElementById("summary-grid");
  const entryCountTag = document.getElementById("entry-count-tag");
  const periodTag = document.getElementById("period-tag");

  const entries = state.filteredEntries;
  entryCountTag.textContent = `기록 ${entries.length.toLocaleString("ko-KR")}개`;

  if (entries.length) {
    const first = entries[0].date;
    const last = entries[entries.length - 1].date;
    periodTag.textContent = `${DATE_FORMATTER.format(first)} ~ ${DATE_FORMATTER.format(last)}`;
  } else {
    periodTag.textContent = "기간 선택 필요";
  }

  grid.innerHTML = "";
  if (!entries.length) return;

  const satisfactionValues = entries
    .map((entry) => entry.satisfaction)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  const avgSatisfaction =
    satisfactionValues.length > 0
      ? satisfactionValues.reduce((acc, cur) => acc + cur, 0) / satisfactionValues.length
      : null;

  const totalTodos = entries.reduce((acc, cur) => acc + cur.totalTodos, 0);
  const totalCompleted = entries.reduce((acc, cur) => acc + cur.completedTodos, 0);
  const avgTodos = entries.length ? totalTodos / entries.length : 0;
  const avgCompletion = entries.length ? totalCompleted / Math.max(totalTodos, 1) : 0;

  const gratitudeItems = entries.reduce((acc, cur) => acc + cur.gratitude.length, 0);
  const gratitudePerDay = entries.length ? gratitudeItems / entries.length : 0;

  const streaks = calculateStreaks(entries);

  const summaryData = [
    {
      title: "평균 만족도",
      value: avgSatisfaction ? `${avgSatisfaction.toFixed(2)} / 5` : "데이터 없음",
      detail:
        satisfactionValues.length > 0
          ? `기록된 ${satisfactionValues.length}일 기준`
          : "만족도 정보가 포함된 기록이 없어요",
    },
    {
      title: "평균 할 일 완료율",
      value: `${Math.round(avgCompletion * 100)}%`,
      detail: `하루 평균 ${avgTodos.toFixed(1)}개 계획, ${(
        (entries.length ? totalCompleted / entries.length : 0) || 0
      ).toFixed(1)}개 완료`,
    },
    {
      title: "감사 일기",
      value: `${gratitudeItems.toLocaleString("ko-KR")}건`,
      detail: `일 평균 ${gratitudePerDay.toFixed(1)}건 작성`,
    },
    {
      title: "연속 기록",
      value: streaks.current ? `${streaks.current}일째` : "연속 없음",
      detail: `최장 ${streaks.longest}일 연속 기록 달성`,
    },
  ];

  summaryData.forEach((item) => {
    const card = document.createElement("article");
    card.className = "summary-card";

    const title = document.createElement("h3");
    title.textContent = item.title;
    card.append(title);

    const value = document.createElement("strong");
    value.textContent = item.value;
    card.append(value);

    const detail = document.createElement("span");
    detail.className = "summary-detail";
    detail.textContent = item.detail;
    card.append(detail);

    grid.append(card);
  });
}

function renderCharts() {
  const entries = state.filteredEntries;
  const chartLegend = document.getElementById("chart-legend");
  chartLegend.textContent = "";

  const satisfactionCanvas = document.getElementById("satisfaction-chart");
  const todoCanvas = document.getElementById("todo-chart");
  const cumulativeCanvas = document.getElementById("cumulative-chart");

  if (!entries.length) {
    destroyChart("satisfaction");
    destroyChart("todo");
    destroyChart("cumulative");
    satisfactionCanvas.replaceWith(satisfactionCanvas.cloneNode(true));
    todoCanvas.replaceWith(todoCanvas.cloneNode(true));
    cumulativeCanvas.replaceWith(cumulativeCanvas.cloneNode(true));
    return;
  }

  const labels = entries.map((entry) => entry.dateLabel);
  const satisfactionData = entries.map((entry) =>
    typeof entry.satisfaction === "number" ? Number(entry.satisfaction.toFixed(2)) : null
  );
  const todoTotals = entries.map((entry) => entry.totalTodos);
  const todoCompleted = entries.map((entry) => entry.completedTodos);
  const completionRates = entries.map((entry) => Math.round(entry.completionRate * 100));
  const gratitudeCounts = entries.map((entry) => entry.gratitude.length);

  const satisfactionCtx = satisfactionCanvas.getContext("2d");
  destroyChart("satisfaction");
  state.charts.satisfaction = new Chart(satisfactionCtx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "만족도",
          data: satisfactionData,
          spanGaps: true,
          borderColor: "#4c6ef5",
          backgroundColor: "rgba(76, 110, 245, 0.2)",
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y;
              return typeof value === "number" ? `만족도: ${value.toFixed(1)} / 5` : "데이터 없음";
            },
          },
        },
      },
      scales: {
        y: {
          suggestedMin: 0,
          suggestedMax: 5,
        },
      },
    },
  });

  const todoCtx = todoCanvas.getContext("2d");
  destroyChart("todo");
  state.charts.todo = new Chart(todoCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "완료한 할 일",
          data: todoCompleted,
          backgroundColor: "rgba(47, 158, 68, 0.6)",
          borderRadius: 6,
        },
        {
          label: "전체 할 일",
          data: todoTotals,
          backgroundColor: "rgba(76, 110, 245, 0.35)",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  });

  const cumulativeCtx = cumulativeCanvas.getContext("2d");
  destroyChart("cumulative");

  let cumulativeTodos = 0;
  let cumulativeCompleted = 0;
  let cumulativeGratitude = 0;
  const cumulativeTodosData = [];
  const cumulativeCompletedData = [];
  const cumulativeGratitudeData = [];

  entries.forEach((entry) => {
    cumulativeTodos += entry.totalTodos;
    cumulativeCompleted += entry.completedTodos;
    cumulativeGratitude += entry.gratitude.length;
    cumulativeTodosData.push(cumulativeTodos);
    cumulativeCompletedData.push(cumulativeCompleted);
    cumulativeGratitudeData.push(cumulativeGratitude);
  });

  state.charts.cumulative = new Chart(cumulativeCtx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "누적 완료",
          data: cumulativeCompletedData,
          borderColor: "#2f9e44",
          backgroundColor: "rgba(47, 158, 68, 0.18)",
          fill: true,
          tension: 0.3,
        },
        {
          label: "누적 계획",
          data: cumulativeTodosData,
          borderColor: "#4c6ef5",
          borderDash: [6, 4],
          fill: false,
          tension: 0.3,
        },
        {
          label: "누적 감사",
          data: cumulativeGratitudeData,
          borderColor: "#f08c00",
          backgroundColor: "rgba(240, 140, 0, 0.15)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const label = context.dataset.label ?? "";
              const value = context.parsed.y ?? 0;
              return `${label}: ${value.toLocaleString("ko-KR")}개`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });

  const legendItems = [
    "만족도",
    "완료한 할 일",
    "전체 할 일",
    "누적 완료",
    "누적 계획",
    "누적 감사",
  ];
  legendItems.forEach((text) => {
    const span = document.createElement("span");
    span.textContent = text;
    chartLegend.append(span);
  });
}

function destroyChart(key) {
  const chart = state.charts[key];
  if (chart) {
    chart.destroy();
    state.charts[key] = null;
  }
}

function renderGratitudeSection() {
  const entries = state.filteredEntries;
  const container = document.getElementById("gratitude-list");
  const summary = document.getElementById("gratitude-summary");
  const searchTerm = document.getElementById("gratitude-search").value.trim().toLowerCase();
  const sortValue = document.getElementById("gratitude-sort").value;

  const gratitudeEntries = entries
    .map((entry) => ({
      dateLabel: entry.dateLabel,
      gratitude: entry.gratitude,
      raw: entry,
    }))
    .filter((item) => item.gratitude.length > 0);

  if (!gratitudeEntries.length) {
    summary.textContent = "감사일기 데이터가 아직 없어요.";
    container.innerHTML = "";
    return;
  }

  const filtered = gratitudeEntries.filter((item) => {
    if (!searchTerm) return true;
    return item.gratitude.some((text) => text.toLowerCase().includes(searchTerm));
  });

  const sorted = filtered.sort((a, b) => {
    switch (sortValue) {
      case "date-asc":
        return a.raw.date - b.raw.date;
      case "length-desc":
        return b.gratitude.length - a.gratitude.length;
      case "length-asc":
        return a.gratitude.length - b.gratitude.length;
      case "date-desc":
      default:
        return b.raw.date - a.raw.date;
    }
  });

  const gratitudeCount = filtered.reduce((acc, cur) => acc + cur.gratitude.length, 0);
  if (filtered.length === gratitudeEntries.length && !searchTerm) {
    summary.textContent = `총 ${gratitudeEntries.length.toLocaleString(
      "ko-KR"
    )}일, 감사 메모 ${gratitudeCount.toLocaleString("ko-KR")}건`;
  } else {
    summary.textContent = `검색 결과 ${filtered.length.toLocaleString(
      "ko-KR"
    )}일, 감사 메모 ${gratitudeCount.toLocaleString("ko-KR")}건`;
  }

  container.innerHTML = "";

  if (!sorted.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "검색 결과가 없습니다.";
    container.append(empty);
    return;
  }

  sorted.forEach((item) => {
    const card = document.createElement("article");
    card.className = "gratitude-card";

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = item.dateLabel;
    header.append(title);

    const count = document.createElement("span");
    count.textContent = `${item.gratitude.length}건`;
    header.append(count);

    card.append(header);

    const list = document.createElement("ul");
    list.className = "gratitude-items";
    item.gratitude.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      list.append(li);
    });
    card.append(list);

    container.append(card);
  });
}

function renderTable() {
  const tbody = document.getElementById("entries-table");
  tbody.innerHTML = "";

  const entries = state.filteredEntries;
  entries.forEach((entry) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = entry.dateLabel;
    row.append(dateCell);

    const satisfactionCell = document.createElement("td");
    satisfactionCell.textContent =
      typeof entry.satisfaction === "number" ? `${entry.satisfaction.toFixed(1)}` : "-";
    row.append(satisfactionCell);

    const todoCell = document.createElement("td");
    todoCell.textContent = `${entry.completedTodos} / ${entry.totalTodos}`;
    row.append(todoCell);

    const completionCell = document.createElement("td");
    const percent = Math.round(entry.completionRate * 100);
    completionCell.textContent = `${percent}%`;
    row.append(completionCell);

    const gratitudeCell = document.createElement("td");
    if (entry.gratitude.length) {
      gratitudeCell.textContent = entry.gratitude.join(", ");
    } else if (entry.notes.length) {
      gratitudeCell.textContent = entry.notes.join(" / ");
    } else {
      gratitudeCell.textContent = "-";
    }
    row.append(gratitudeCell);

    tbody.append(row);
  });
}

function handleExport() {
  const entries = state.filteredEntries;
  if (!entries.length) {
    alert("내보낼 데이터가 없습니다.");
    return;
  }

  const payload = entries.map((entry) => entry.original);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const date = new Date();
  link.download = `insights-export-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}.json`;
  document.body.append(link);
  link.click();
  URL.revokeObjectURL(url);
  link.remove();
}

function handleFileImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) {
        alert("JSON 배열 형식의 데이터를 불러와 주세요.");
        return;
      }
      localStorage.setItem("insightsImportedEntries", JSON.stringify(parsed));
      initializeDatasets();
      setDefaultFilters();
      applyFilters();
      alert("데이터를 불러왔어요. 데이터 선택 목록에서 \"불러온 JSON\"을 확인해 보세요.");
    } catch (error) {
      alert("JSON 파일을 읽는 중 오류가 발생했습니다.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function isRecordLike(item) {
  if (!item || typeof item !== "object") return false;
  const dateFields = ["date", "createdAt", "day", "timestamp"];
  const todoFields = ["todos", "todoList", "tasks", "checklist", "items", "toDos"];
  const gratitudeFields = ["gratitude", "gratefulFor", "gratitudeEntries", "thanks"];

  const hasDate = dateFields.some((field) => field in item);
  const hasTodos = todoFields.some((field) => Array.isArray(item[field]));
  const hasGratitude = gratitudeFields.some((field) => field in item);

  return hasDate || hasTodos || hasGratitude;
}

function normalizeEntries(entries) {
  const normalized = entries
    .map((entry) => normalizeEntry(entry))
    .filter((entry) => entry !== null)
    .sort((a, b) => a.date - b.date);
  return normalized;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const date = parseDate(entry);
  if (!date) return null;

  const satisfaction = parseSatisfaction(entry);
  const todos = parseTodos(entry);
  const gratitude = parseGratitude(entry);
  const notes = parseNotes(entry);

  return {
    id: `${date.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    dateLabel: toISODate(date),
    satisfaction,
    totalTodos: todos.total,
    completedTodos: todos.completed,
    completionRate: todos.total ? todos.completed / todos.total : 0,
    gratitude,
    notes,
    original: entry,
  };
}

function parseDate(entry) {
  const dateFields = ["date", "createdAt", "day", "timestamp"];
  for (const field of dateFields) {
    if (entry[field]) {
      const value = entry[field];
      const parsed = typeof value === "number" ? new Date(value) : new Date(String(value));
      if (!Number.isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
    }
  }
  return null;
}

function parseSatisfaction(entry) {
  const fields = ["satisfaction", "score", "rating", "mood", "emotion", "feeling"];
  for (const field of fields) {
    if (field in entry) {
      const value = entry[field];
      const number = Number(value);
      if (!Number.isNaN(number)) {
        let normalized = number;
        if (number > 5 && number <= 100) {
          normalized = Number((number / 20).toFixed(1));
        }
        return Math.max(0, Math.min(5, normalized));
      }
    }
  }
  return null;
}

function parseTodos(entry) {
  const fields = ["todos", "todoList", "tasks", "checklist", "items", "toDos"];
  for (const field of fields) {
    const value = entry[field];
    if (Array.isArray(value)) {
      let total = 0;
      let completed = 0;
      value.forEach((item) => {
        if (typeof item === "string") {
          total += 1;
          return;
        }
        if (item && typeof item === "object") {
          total += 1;
          const done = Boolean(
            item.completed ?? item.done ?? item.isDone ?? item.checked ?? item.status === "done"
          );
          if (done) completed += 1;
        }
      });
      return { total, completed };
    }
  }
  return { total: 0, completed: 0 };
}

function parseGratitude(entry) {
  const fields = ["gratitude", "gratefulFor", "gratitudeEntries", "thanks", "gratitudeList"];
  for (const field of fields) {
    const value = entry[field];
    if (!value) continue;
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item : item?.text ?? ""))
        .filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(/[\n,]/)
        .map((token) => token.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function parseNotes(entry) {
  const fields = ["note", "notes", "memo", "reflection", "summary"];
  const result = [];
  fields.forEach((field) => {
    if (!entry[field]) return;
    if (Array.isArray(entry[field])) {
      entry[field].forEach((item) => {
        if (typeof item === "string") result.push(item);
      });
    } else if (typeof entry[field] === "string") {
      result.push(entry[field]);
    }
  });
  return result;
}

function calculateStreaks(entries) {
  if (!entries.length) return { current: 0, longest: 0 };

  let longest = 1;
  let streak = 1;

  for (let i = 1; i < entries.length; i += 1) {
    const prev = entries[i - 1].date;
    const current = entries[i].date;
    const diff = Math.round((current - prev) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
    if (streak > longest) {
      longest = streak;
    }
  }

  let currentStreak = 1;
  for (let i = entries.length - 1; i > 0; i -= 1) {
    const current = entries[i].date;
    const prev = entries[i - 1].date;
    const diff = Math.round((current - prev) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const today = new Date();
  const lastEntry = entries[entries.length - 1].date;
  const daysFromLast = Math.floor((today - lastEntry) / (1000 * 60 * 60 * 24));
  if (daysFromLast > 1) {
    currentStreak = 0;
  }

  return {
    current: currentStreak,
    longest,
  };
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSampleDataset() {
  const today = new Date();
  const sampleEntries = [];
  for (let i = 0; i < 14; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - i));
    sampleEntries.push({
      date: toISODate(date),
      satisfaction: Math.max(2, Math.min(5, Math.round(Math.random() * 3 + 2))),
      todos: [
        { title: "아침 스트레칭", completed: Math.random() > 0.3 },
        { title: "공부 2시간", completed: Math.random() > 0.4 },
        { title: "감사일기", completed: Math.random() > 0.1 },
      ],
      gratitude: ["좋은 날씨", "따뜻한 대화", "성장하는 나"].slice(0, Math.floor(Math.random() * 3) + 1),
      note: "샘플 데이터입니다.",
    });
  }
  return {
    key: "sample",
    label: "샘플 데이터 (체험용)",
    entries: sampleEntries,
    source: "sample",
  };
}

/* ---------------------- Memo Board Logic ---------------------- */

const MEMO_STORAGE_KEY = "insightsMemos";

function initializeMemoBoard() {
  const form = document.getElementById("memo-form");
  form.addEventListener("submit", handleMemoSubmit);

  document
    .getElementById("memo-filter")
    .addEventListener("change", renderMemoList);
  document
    .getElementById("memo-search")
    .addEventListener("input", renderMemoList);
  document.getElementById("calendar-prev").addEventListener("click", () => {
    state.calendarCursor.setMonth(state.calendarCursor.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("calendar-next").addEventListener("click", () => {
    state.calendarCursor.setMonth(state.calendarCursor.getMonth() + 1);
    renderCalendar();
  });

  renderMemoList();
  renderCalendar();
}

function loadMemos() {
  const stored = localStorage.getItem(MEMO_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.map((memo) => ({
        ...memo,
        createdAt: memo.createdAt ? new Date(memo.createdAt) : new Date(),
      }));
    }
  } catch (error) {
    console.warn("메모를 불러올 수 없습니다.", error);
  }
  return [];
}

function saveMemos(memos) {
  localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memos));
}

function handleMemoSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const title = formData.get("title").trim();
  if (!title) return;

  const memo = {
    id: crypto.randomUUID?.() ?? `memo-${Date.now()}`,
    title,
    body: (formData.get("body") ?? "").toString().trim(),
    pinned: formData.get("pinned") === "on",
    highlight: formData.get("highlight") === "on",
    completed: false,
    createdAt: new Date().toISOString(),
    dueDate: formData.get("date") ? new Date(formData.get("date")).toISOString() : null,
  };

  const memos = loadMemos();
  memos.push(memo);
  saveMemos(memos);
  form.reset();
  renderMemoList();
  renderCalendar();
}

function renderMemoList() {
  const container = document.getElementById("memo-list");
  const filter = document.getElementById("memo-filter").value;
  const query = document.getElementById("memo-search").value.trim().toLowerCase();

  const memos = loadMemos();
  const sorted = memos.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const dateA = a.dueDate ? new Date(a.dueDate) : null;
    const dateB = b.dueDate ? new Date(b.dueDate) : null;
    if (dateA && dateB) return dateA - dateB;
    if (dateA) return -1;
    if (dateB) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const filtered = sorted.filter((memo) => {
    if (filter === "upcoming" && !memo.dueDate) return false;
    if (filter === "pinned" && !memo.pinned) return false;
    if (filter === "completed" && !memo.completed) return false;
    if (filter === "all") {
      // pass
    }
    if (query) {
      const text = `${memo.title} ${memo.body ?? ""}`.toLowerCase();
      return text.includes(query);
    }
    return true;
  });

  container.innerHTML = "";
  const template = document.getElementById("memo-template");

  filtered.forEach((memo) => {
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector(".memo-card");
    card.dataset.id = memo.id;
    card.classList.toggle("highlight", Boolean(memo.highlight));
    card.classList.toggle("completed", Boolean(memo.completed));
    if (memo.pinned) card.classList.add("pinned");

    const title = clone.querySelector(".memo-title");
    title.textContent = memo.title;

    const meta = clone.querySelector(".memo-meta");
    const created = DATE_FORMATTER.format(new Date(memo.createdAt));
    const due = memo.dueDate ? DATE_FORMATTER.format(new Date(memo.dueDate)) : null;
    meta.textContent = due ? `등록 ${created} · 예정 ${due}` : `등록 ${created}`;

    const body = clone.querySelector(".memo-body");
    body.textContent = memo.body || "";

    clone.querySelectorAll(".memo-action").forEach((button) => {
      button.addEventListener("click", () => handleMemoAction(memo.id, button.dataset.action));
    });

    container.append(clone);
  });

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "조건에 맞는 메모가 없습니다.";
    empty.className = "helper-text";
    container.append(empty);
  }
}

function handleMemoAction(id, action) {
  const memos = loadMemos();
  const memo = memos.find((item) => item.id === id);
  if (!memo) return;

  if (action === "toggle-pin") {
    memo.pinned = !memo.pinned;
  } else if (action === "toggle-complete") {
    memo.completed = !memo.completed;
  } else if (action === "delete") {
    const confirmed = confirm("정말 삭제할까요?");
    if (!confirmed) return;
    const index = memos.findIndex((item) => item.id === id);
    memos.splice(index, 1);
  }

  saveMemos(memos);
  renderMemoList();
  renderCalendar();
}

function renderCalendar() {
  const container = document.getElementById("calendar-days");
  container.innerHTML = "";

  const year = state.calendarCursor.getFullYear();
  const month = state.calendarCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const memos = loadMemos();

  document.getElementById("calendar-label").textContent = `${year}년 ${month + 1}월`;

  for (let i = 0; i < firstWeekDay; i += 1) {
    const placeholder = document.createElement("div");
    placeholder.className = "calendar-cell placeholder";
    container.append(placeholder);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, month, day);
    const isoDate = toISODate(cellDate);
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = day;
    cell.append(dayNumber);

    const dailyMemos = memos.filter((memo) => memo.dueDate && toISODate(new Date(memo.dueDate)) === isoDate);
    dailyMemos.forEach((memo) => {
      const dot = document.createElement("span");
      dot.className = "memo-dot";
      if (memo.highlight) dot.classList.add("highlight");
      if (memo.completed) dot.classList.add("completed");
      if (memo.pinned) dot.classList.add("pinned");
      dot.title = `${memo.title} - ${memo.body ?? ""}`;
      cell.append(dot);
    });

    cell.addEventListener("click", () => {
      const filter = document.getElementById("memo-filter");
      filter.value = "all";
      const search = document.getElementById("memo-search");
      search.value = isoDate;
      renderMemoList();
    });

    container.append(cell);
  }
}

