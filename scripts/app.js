const STORAGE_KEY = "journalEntries";
const DATE_FORMATTER = new Intl.DateTimeFormat("ko", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

let entries = [];
let draftTasks = [];
let draftGratitude = [];

document.addEventListener("DOMContentLoaded", () => {
  entries = loadEntries();
  initializeForm();
  initializeControls();
  renderStats();
  renderEntries();
});

function initializeForm() {
  const form = document.getElementById("entry-form");
  const dateInput = document.getElementById("entry-date");
  const satisfactionInput = document.getElementById("entry-satisfaction");
  const satisfactionDisplay = document.getElementById("satisfaction-display");
  const skipCheckbox = document.getElementById("skip-satisfaction");
  const taskInput = document.getElementById("task-input");
  const gratitudeInput = document.getElementById("gratitude-input");

  dateInput.value = toISODate(new Date());

  const updateSatisfactionDisplay = () => {
    if (skipCheckbox.checked) {
      satisfactionDisplay.textContent = "미입력";
    } else {
      const value = Number(satisfactionInput.value);
      satisfactionDisplay.textContent = Number.isNaN(value) ? "-" : value.toFixed(1);
    }
  };

  satisfactionInput.addEventListener("input", updateSatisfactionDisplay);
  skipCheckbox.addEventListener("change", () => {
    satisfactionInput.disabled = skipCheckbox.checked;
    updateSatisfactionDisplay();
  });
  updateSatisfactionDisplay();

  document.getElementById("add-task-button").addEventListener("click", () => {
    addTaskToDraft(taskInput.value);
    taskInput.focus();
  });

  taskInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTaskToDraft(taskInput.value);
    }
  });

  document.getElementById("task-list").addEventListener("click", (event) => {
    if (event.target.closest("[data-action=\"remove-task\"]")) {
      const li = event.target.closest("li");
      if (!li) return;
      const { id } = li.dataset;
      draftTasks = draftTasks.filter((task) => task.id !== id);
      renderDraftTasks();
    }
  });

  document.getElementById("task-list").addEventListener("change", (event) => {
    if (event.target.matches(".draft-task-toggle")) {
      const li = event.target.closest("li");
      if (!li) return;
      const { id } = li.dataset;
      const task = draftTasks.find((item) => item.id === id);
      if (task) {
        task.completed = event.target.checked;
      }
    }
  });

  document.getElementById("add-gratitude-button").addEventListener("click", () => {
    addGratitudeToDraft(gratitudeInput.value);
    gratitudeInput.focus();
  });

  gratitudeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addGratitudeToDraft(gratitudeInput.value);
    }
  });

  document.getElementById("gratitude-draft-list").addEventListener("click", (event) => {
    if (event.target.closest("[data-action=\"remove-gratitude\"]")) {
      const li = event.target.closest("li");
      if (!li) return;
      const { id } = li.dataset;
      draftGratitude = draftGratitude.filter((item) => item.id !== id);
      renderDraftGratitude();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleFormSubmit({ form, dateInput, satisfactionInput, skipCheckbox });
  });

  form.addEventListener("reset", () => {
    window.requestAnimationFrame(() => {
      draftTasks = [];
      draftGratitude = [];
      renderDraftTasks();
      renderDraftGratitude();
      dateInput.value = toISODate(new Date());
      skipCheckbox.checked = false;
      satisfactionInput.disabled = false;
      satisfactionInput.value = "3";
      updateSatisfactionDisplay();
      const message = document.getElementById("form-message");
      message.textContent = "";
      message.style.color = "var(--text-secondary)";
    });
  });

  renderDraftTasks();
  renderDraftGratitude();
}

function initializeControls() {
  const monthFilter = document.getElementById("month-filter");
  const searchInput = document.getElementById("search-input");
  const clearFiltersButton = document.getElementById("clear-filters");
  const entriesContainer = document.getElementById("entries-container");
  const exportButton = document.getElementById("entry-export-button");
  const importInput = document.getElementById("entry-import-input");

  monthFilter.addEventListener("change", renderEntries);
  searchInput.addEventListener("input", () => {
    renderEntries();
  });
  clearFiltersButton.addEventListener("click", () => {
    monthFilter.value = "";
    searchInput.value = "";
    renderEntries();
  });

  entriesContainer.addEventListener("change", (event) => {
    if (event.target.matches(".task-toggle")) {
      const card = event.target.closest(".entry-card");
      if (!card) return;
      const entryId = card.dataset.entryId;
      const taskId = event.target.dataset.taskId;
      toggleTask(entryId, taskId, event.target.checked);
    }
  });
  entriesContainer.addEventListener("click", (event) => {
    const card = event.target.closest(".entry-card");
    if (!card) return;
    const entryId = card.dataset.entryId;

    if (event.target.matches("[data-action=\"delete-entry\"]")) {
      deleteEntry(entryId);
    } else if (event.target.matches("[data-action=\"remove-task\"]")) {
      const li = event.target.closest("li");
      if (!li) return;
      const taskId = li.dataset.taskId ?? li.dataset.id;
      if (taskId) {
        removeTask(entryId, taskId);
      }
    } else if (event.target.matches("[data-action=\"remove-gratitude\"]")) {
      const li = event.target.closest("li");
      if (!li) return;
      const gratitudeId = li.dataset.gratitudeId ?? li.dataset.id;
      if (gratitudeId) {
        removeGratitude(entryId, gratitudeId);
      }
    }
  });

  entriesContainer.addEventListener("submit", (event) => {
    if (event.target.matches(".add-task-form")) {
      event.preventDefault();
      const card = event.target.closest(".entry-card");
      if (!card) return;
      const entryId = card.dataset.entryId;
      const input = event.target.querySelector("input");
      if (!input) return;
      const value = input.value.trim();
      if (!value) return;
      addTaskToEntry(entryId, value);
      input.value = "";
    } else if (event.target.matches(".add-gratitude-form")) {
      event.preventDefault();
      const card = event.target.closest(".entry-card");
      if (!card) return;
      const entryId = card.dataset.entryId;
      const input = event.target.querySelector("input");
      if (!input) return;
      const value = input.value.trim();
      if (!value) return;
      addGratitudeToEntry(entryId, value);
      input.value = "";
    }
  });

  exportButton.addEventListener("click", handleExport);
  importInput.addEventListener("change", handleImport);
}

function addTaskToDraft(rawValue) {
  const value = rawValue.trim();
  if (!value) return;
  draftTasks.push({
    id: createId("task"),
    title: value,
    completed: false,
  });
  document.getElementById("task-input").value = "";
  renderDraftTasks();
}

function addGratitudeToDraft(rawValue) {
  const value = rawValue.trim();
  if (!value) return;
  draftGratitude.push({
    id: createId("gratitude"),
    text: value,
  });
  document.getElementById("gratitude-input").value = "";
  renderDraftGratitude();
}

function renderDraftTasks() {
  const list = document.getElementById("task-list");
  list.innerHTML = "";
  if (!draftTasks.length) {
    const li = document.createElement("li");
    li.className = "placeholder";
    li.textContent = "할 일을 추가해 주세요.";
    list.append(li);
    return;
  }

  draftTasks.forEach((task) => {
    const li = document.createElement("li");
    li.dataset.id = task.id;

    const label = document.createElement("label");
    label.className = "task-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "draft-task-toggle";
    checkbox.checked = Boolean(task.completed);

    const span = document.createElement("span");
    span.textContent = task.title;

    label.append(checkbox, span);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-button";
    removeButton.dataset.action = "remove-task";
    removeButton.setAttribute("aria-label", `${task.title} 삭제`);
    removeButton.textContent = "✕";

    li.append(label, removeButton);
    list.append(li);
  });
}

function renderDraftGratitude() {
  const list = document.getElementById("gratitude-draft-list");
  list.innerHTML = "";
  if (!draftGratitude.length) {
    const li = document.createElement("li");
    li.className = "placeholder";
    li.textContent = "감사한 일을 추가해 보세요.";
    list.append(li);
    return;
  }

  draftGratitude.forEach((item) => {
    const li = document.createElement("li");
    li.dataset.id = item.id;

    const span = document.createElement("span");
    span.textContent = item.text;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button";
    button.dataset.action = "remove-gratitude";
    button.setAttribute("aria-label", `${item.text} 삭제`);
    button.textContent = "✕";

    li.append(span, button);
    list.append(li);
  });
}

function handleFormSubmit({ form, dateInput, satisfactionInput, skipCheckbox }) {
  const dateValue = dateInput.value;
  if (!dateValue) {
    showMessage("날짜를 선택해 주세요.", true);
    return;
  }

  const noteValue = (document.getElementById("entry-note").value ?? "").trim();
  let satisfaction = null;
  if (!skipCheckbox.checked) {
    const parsed = Number(satisfactionInput.value);
    if (!Number.isNaN(parsed)) {
      satisfaction = Math.max(0, Math.min(5, parsed));
    }
  }

  const entry = {
    id: createId("entry"),
    date: dateValue,
    satisfaction,
    todos: draftTasks.map((task) => ({
      id: task.id,
      title: task.title,
      completed: Boolean(task.completed),
    })),
    gratitude: draftGratitude.map((item) => ({ id: item.id, text: item.text })),
    note: noteValue,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  entries.push(entry);
  saveEntries();
  renderStats();
  renderEntries();

  showMessage("기록을 저장했어요!");
  form.reset();
}

function showMessage(message, isError = false) {
  const element = document.getElementById("form-message");
  element.textContent = message;
  element.style.color = isError ? "var(--danger)" : "var(--text-secondary)";
  if (message) {
    window.setTimeout(() => {
      if (element.textContent === message) {
        element.textContent = "";
        element.style.color = "var(--text-secondary)";
      }
    }, 4000);
  }
}
function renderStats() {
  const totalEntries = entries.length;
  const totalEl = document.getElementById("stat-total-entries");
  const periodEl = document.getElementById("stat-period");
  const averageEl = document.getElementById("stat-average-satisfaction");
  const averageDetailEl = document.getElementById("stat-satisfaction-count");
  const completionEl = document.getElementById("stat-completion-rate");
  const completionDetailEl = document.getElementById("stat-completion-detail");
  const streakEl = document.getElementById("stat-streak");
  const streakDetailEl = document.getElementById("stat-longest-streak");

  totalEl.textContent = totalEntries.toLocaleString("ko-KR");

  if (!totalEntries) {
    periodEl.textContent = "기록을 추가해 보세요.";
    averageEl.textContent = "-";
    averageDetailEl.textContent = "만족도 데이터를 추가해 보세요.";
    completionEl.textContent = "-";
    completionDetailEl.textContent = "등록된 할 일이 없습니다.";
    streakEl.textContent = "0일";
    streakDetailEl.textContent = "연속 기록을 시작해 보세요.";
    return;
  }

  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  periodEl.textContent = `${DATE_FORMATTER.format(new Date(first.date))} ~ ${DATE_FORMATTER.format(
    new Date(last.date)
  )}`;

  const satisfactionValues = entries
    .map((entry) => entry.satisfaction)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  const average =
    satisfactionValues.length > 0
      ? satisfactionValues.reduce((acc, cur) => acc + cur, 0) / satisfactionValues.length
      : null;
  averageEl.textContent = typeof average === "number" ? `${average.toFixed(2)} / 5` : "미입력";
  averageDetailEl.textContent =
    satisfactionValues.length > 0
      ? `${satisfactionValues.length}건의 만족도 기록`
      : "만족도 데이터를 추가해 보세요.";

  const totalTodos = entries.reduce((acc, entry) => acc + entry.todos.length, 0);
  const totalCompleted = entries.reduce(
    (acc, entry) => acc + entry.todos.filter((task) => task.completed).length,
    0
  );
  const completionRate = totalTodos ? Math.round((totalCompleted / totalTodos) * 100) : 0;
  completionEl.textContent = totalTodos ? `${completionRate}%` : "-";
  completionDetailEl.textContent = totalTodos
    ? `완료 ${totalCompleted.toLocaleString("ko-KR")} / 총 ${totalTodos.toLocaleString("ko-KR")}`
    : "등록된 할 일이 없습니다.";

  const streak = calculateStreak(entries);
  streakEl.textContent = streak.current ? `${streak.current}일째` : "0일";
  streakDetailEl.textContent = streak.longest
    ? `최장 ${streak.longest}일 연속`
    : "연속 기록을 시작해 보세요.";
}

function renderEntries() {
  const container = document.getElementById("entries-container");
  container.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "아직 저장된 기록이 없습니다. 위 양식을 통해 첫 기록을 추가해 보세요.";
    container.append(empty);
    return;
  }

  const monthValue = document.getElementById("month-filter").value;
  const searchValue = document.getElementById("search-input").value.trim().toLowerCase();

  let filtered = [...entries];

  if (monthValue) {
    const [yearStr, monthStr] = monthValue.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isNaN(year) && !Number.isNaN(month)) {
      filtered = filtered.filter((entry) => {
        const date = new Date(entry.date);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
      });
    }
  }

  if (searchValue) {
    filtered = filtered.filter((entry) => {
      const text = [
        entry.date,
        entry.note,
        entry.gratitude.map((item) => item.text).join(" "),
        entry.todos.map((task) => task.title).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(searchValue);
    });
  }

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "조건에 맞는 기록이 없습니다.";
    container.append(empty);
    return;
  }

  filtered.sort((a, b) => {
    const diff = new Date(b.date) - new Date(a.date);
    if (diff !== 0) return diff;
    return (
      new Date(b.updatedAt ?? b.createdAt ?? b.date) -
      new Date(a.updatedAt ?? a.createdAt ?? a.date)
    );
  });

  const fragment = document.createDocumentFragment();

  filtered.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "entry-card";
    card.dataset.entryId = entry.id;

    const header = document.createElement("header");
    header.className = "entry-header";

    const headerInfo = document.createElement("div");
    const dateTitle = document.createElement("h3");
    dateTitle.className = "entry-date";
    dateTitle.textContent = DATE_FORMATTER.format(new Date(entry.date));
    headerInfo.append(dateTitle);

    const meta = document.createElement("p");
    meta.className = "entry-meta";
    const totalTasks = entry.todos.length;
    const completedTasks = entry.todos.filter((task) => task.completed).length;
    const satisfactionText =
      typeof entry.satisfaction === "number"
        ? `만족도 ${entry.satisfaction.toFixed(1)} / 5`
        : "만족도 미기록";
    const completionText = totalTasks ? `할 일 ${completedTasks}/${totalTasks} 완료` : "할 일 없음";
    meta.textContent = `${satisfactionText} · ${completionText}`;
    headerInfo.append(meta);

    header.append(headerInfo);

    const actions = document.createElement("div");
    actions.className = "entry-actions";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "ghost-button small danger";
    deleteButton.dataset.action = "delete-entry";
    deleteButton.textContent = "삭제";
    actions.append(deleteButton);
    header.append(actions);

    card.append(header);

    const tasksSection = document.createElement("section");
    tasksSection.className = "entry-section tasks";
    const tasksTitle = document.createElement("h4");
    tasksTitle.textContent = "할 일";
    tasksSection.append(tasksTitle);

    const taskList = document.createElement("ul");
    taskList.className = "entry-task-list";

    if (entry.todos.length) {
      entry.todos.forEach((task) => {
        const li = document.createElement("li");
        li.dataset.taskId = task.id;

        const label = document.createElement("label");
        label.className = "task-label";
        if (task.completed) {
          label.classList.add("completed");
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-toggle";
        checkbox.checked = Boolean(task.completed);
        checkbox.dataset.taskId = task.id;

        const span = document.createElement("span");
        span.textContent = task.title;

        label.append(checkbox, span);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "icon-button";
        removeButton.dataset.action = "remove-task";
        removeButton.setAttribute("aria-label", `${task.title} 삭제`);
        removeButton.textContent = "✕";

        li.append(label, removeButton);
        taskList.append(li);
      });
    } else {
      const li = document.createElement("li");
      li.className = "placeholder";
      li.textContent = "등록된 할 일이 없습니다.";
      taskList.append(li);
    }

    tasksSection.append(taskList);

    const addTaskForm = document.createElement("form");
    addTaskForm.className = "inline-form add-task-form";
    const addTaskInput = document.createElement("input");
    addTaskInput.type = "text";
    addTaskInput.placeholder = "새 할 일 추가";
    addTaskInput.setAttribute("aria-label", "새 할 일");
    const addTaskButton = document.createElement("button");
    addTaskButton.type = "submit";
    addTaskButton.className = "ghost-button small";
    addTaskButton.textContent = "추가";
    addTaskForm.append(addTaskInput, addTaskButton);
    tasksSection.append(addTaskForm);

    card.append(tasksSection);

    const gratitudeSection = document.createElement("section");
    gratitudeSection.className = "entry-section gratitude";
    const gratitudeTitle = document.createElement("h4");
    gratitudeTitle.textContent = "감사한 일";
    gratitudeSection.append(gratitudeTitle);

    const gratitudeList = document.createElement("ul");
    gratitudeList.className = "entry-gratitude-list";

    if (entry.gratitude.length) {
      entry.gratitude.forEach((item) => {
        const li = document.createElement("li");
        li.dataset.gratitudeId = item.id;

        const span = document.createElement("span");
        span.textContent = item.text;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "icon-button";
        removeButton.dataset.action = "remove-gratitude";
        removeButton.setAttribute("aria-label", `${item.text} 삭제`);
        removeButton.textContent = "✕";

        li.append(span, removeButton);
        gratitudeList.append(li);
      });
    } else {
      const li = document.createElement("li");
      li.className = "placeholder";
      li.textContent = "감사한 일을 추가해 보세요.";
      gratitudeList.append(li);
    }

    gratitudeSection.append(gratitudeList);

    const addGratitudeForm = document.createElement("form");
    addGratitudeForm.className = "inline-form add-gratitude-form";
    const addGratitudeInput = document.createElement("input");
    addGratitudeInput.type = "text";
    addGratitudeInput.placeholder = "감사한 일 추가";
    addGratitudeInput.setAttribute("aria-label", "새 감사 항목");
    const addGratitudeButton = document.createElement("button");
    addGratitudeButton.type = "submit";
    addGratitudeButton.className = "ghost-button small";
    addGratitudeButton.textContent = "추가";
    addGratitudeForm.append(addGratitudeInput, addGratitudeButton);
    gratitudeSection.append(addGratitudeForm);

    card.append(gratitudeSection);

    const noteSection = document.createElement("section");
    noteSection.className = "entry-section note";
    const noteTitle = document.createElement("h4");
    noteTitle.textContent = "메모";
    noteSection.append(noteTitle);

    const noteParagraph = document.createElement("p");
    noteParagraph.className = "entry-note";
    noteParagraph.textContent = entry.note ? entry.note : "추가된 메모가 없습니다.";
    noteSection.append(noteParagraph);
    card.append(noteSection);

    const footer = document.createElement("footer");
    footer.className = "entry-footer";

    const summary = document.createElement("span");
    summary.className = "entry-summary";
    if (totalTasks) {
      const rate = Math.round((completedTasks / totalTasks) * 100);
      summary.textContent = `완료 ${completedTasks}/${totalTasks} · 완료율 ${rate}%`;
    } else {
      summary.textContent = "할 일 없음";
    }

    const updated = document.createElement("time");
    updated.className = "entry-updated";
    const timestamp = entry.updatedAt ?? entry.createdAt;
    if (timestamp) {
      updated.dateTime = timestamp;
      updated.textContent = `마지막 수정 ${DATE_TIME_FORMATTER.format(new Date(timestamp))}`;
    }

    footer.append(summary, updated);
    card.append(footer);

    fragment.append(card);
  });

  container.append(fragment);
}
function addTaskToEntry(entryId, rawValue) {
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return;
  const value = rawValue.trim();
  if (!value) return;
  entry.todos.push({
    id: createId("task"),
    title: value,
    completed: false,
  });
  entry.updatedAt = new Date().toISOString();
  saveEntries();
  renderStats();
  renderEntries();
}

function addGratitudeToEntry(entryId, rawValue) {
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return;
  const value = rawValue.trim();
  if (!value) return;
  entry.gratitude.push({ id: createId("gratitude"), text: value });
  entry.updatedAt = new Date().toISOString();
  saveEntries();
  renderStats();
  renderEntries();
}

function removeTask(entryId, taskId) {
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return;
  const index = entry.todos.findIndex((task) => task.id === taskId);
  if (index === -1) return;
  entry.todos.splice(index, 1);
  entry.updatedAt = new Date().toISOString();
  saveEntries();
  renderStats();
  renderEntries();
}

function removeGratitude(entryId, gratitudeId) {
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return;
  const index = entry.gratitude.findIndex((item) => item.id === gratitudeId);
  if (index === -1) return;
  entry.gratitude.splice(index, 1);
  entry.updatedAt = new Date().toISOString();
  saveEntries();
  renderStats();
  renderEntries();
}

function toggleTask(entryId, taskId, completed) {
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return;
  const task = entry.todos.find((item) => item.id === taskId);
  if (!task) return;
  task.completed = completed;
  entry.updatedAt = new Date().toISOString();
  saveEntries();
  renderStats();
  renderEntries();
}

function deleteEntry(entryId) {
  const index = entries.findIndex((item) => item.id === entryId);
  if (index === -1) return;
  const confirmed = window.confirm("선택한 기록을 삭제할까요?");
  if (!confirmed) return;
  entries.splice(index, 1);
  saveEntries();
  renderStats();
  renderEntries();
}

function handleExport() {
  if (!entries.length) {
    window.alert("내보낼 기록이 없습니다.");
    return;
  }
  saveEntries();
  const payload = entries.map((entry) => ({
    id: entry.id,
    date: entry.date,
    satisfaction: entry.satisfaction,
    todos: entry.todos.map((task) => ({
      id: task.id,
      title: task.title,
      completed: Boolean(task.completed),
    })),
    gratitude: entry.gratitude.map((item) => ({ id: item.id, text: item.text })),
    note: entry.note,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const now = new Date();
  link.download = `journalEntries-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid JSON");
      }
      const normalized = parsed
        .map((item, index) => normalizeEntry(item, index))
        .filter((item) => item !== null);
      const map = new Map(entries.map((entry) => [entry.id, entry]));
      normalized.forEach((entry) => {
        map.set(entry.id, entry);
      });
      entries = Array.from(map.values());
      saveEntries();
      renderStats();
      renderEntries();
      showMessage(`${normalized.length}개의 기록을 불러왔어요.`);
    } catch (error) {
      console.error("Failed to import", error);
      window.alert("JSON 파일을 불러오지 못했습니다. 형식을 확인해 주세요.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function saveEntries() {
  entries.sort((a, b) => {
    const diff = new Date(a.date) - new Date(b.date);
    if (diff !== 0) return diff;
    return (
      new Date(a.createdAt ?? a.date) -
      new Date(b.createdAt ?? b.date)
    );
  });

  const payload = entries.map((entry) => ({
    id: entry.id,
    date: entry.date,
    satisfaction: typeof entry.satisfaction === "number" ? Number(entry.satisfaction) : null,
    todos: entry.todos.map((task) => ({
      id: task.id,
      title: task.title,
      completed: Boolean(task.completed),
    })),
    gratitude: entry.gratitude.map((item) => ({ id: item.id, text: item.text })),
    note: entry.note ?? "",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(
    new CustomEvent("journalEntries:updated", {
      detail: { entries: payload },
    })
  );
}

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => normalizeEntry(item, index))
      .filter((item) => item !== null)
      .sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt));
  } catch (error) {
    console.warn("기존 기록을 불러오는 중 오류가 발생했습니다.", error);
    return [];
  }
}

function normalizeEntry(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;

  const date = extractDate(raw);
  if (!date) return null;

  const satisfaction = extractSatisfaction(raw);
  const todos = extractTodos(raw);
  const gratitude = extractGratitude(raw);
  const note = extractNote(raw);
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id
      : createId(`entry-${index}`);
  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt
      ? raw.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt
      ? raw.updatedAt
      : createdAt;

  return {
    id,
    date,
    satisfaction,
    todos,
    gratitude,
    note,
    createdAt,
    updatedAt,
  };
}
function extractDate(entry) {
  const fields = ["date", "createdAt", "day", "timestamp"];
  for (const field of fields) {
    if (entry[field]) {
      const value = entry[field];
      const date = typeof value === "number" ? new Date(value) : new Date(String(value));
      if (!Number.isNaN(date.getTime())) {
        return toISODate(date);
      }
    }
  }
  return null;
}

function extractSatisfaction(entry) {
  const fields = ["satisfaction", "score", "rating", "mood", "emotion", "feeling"];
  for (const field of fields) {
    if (field in entry) {
      const number = Number(entry[field]);
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

function extractTodos(entry) {
  const fields = ["todos", "todoList", "tasks", "checklist", "items", "toDos"];
  for (const field of fields) {
    const value = entry[field];
    if (Array.isArray(value)) {
      return value
        .map((item, index) => normalizeTask(item, index))
        .filter((item) => item !== null);
    }
  }
  return [];
}

function normalizeTask(item, index = 0) {
  if (typeof item === "string") {
    const title = item.trim();
    if (!title) return null;
    return {
      id: createId(`task-${index}`),
      title,
      completed: false,
    };
  }
  if (!item || typeof item !== "object") return null;
  const title =
    typeof item.title === "string" && item.title.trim()
      ? item.title.trim()
      : typeof item.text === "string" && item.text.trim()
      ? item.text.trim()
      : typeof item.name === "string" && item.name.trim()
      ? item.name.trim()
      : typeof item.description === "string" && item.description.trim()
      ? item.description.trim()
      : "";
  if (!title) return null;
  const completed = Boolean(
    item.completed ??
      item.done ??
      item.isDone ??
      item.checked ??
      item.status === "done" ??
      item.state === "completed"
  );
  const id =
    typeof item.id === "string" && item.id.trim()
      ? item.id
      : createId(`task-${index}`);
  return {
    id,
    title,
    completed,
  };
}

function extractGratitude(entry) {
  const fields = ["gratitude", "gratefulFor", "gratitudeEntries", "thanks", "gratitudeList"];
  for (const field of fields) {
    const value = entry[field];
    if (!value) continue;
    if (Array.isArray(value)) {
      return value
        .map((item, index) => {
          if (typeof item === "string") {
            const text = item.trim();
            if (!text) return null;
            return { id: createId(`gratitude-${index}`), text };
          }
          if (item && typeof item === "object") {
            const text =
              typeof item.text === "string" && item.text.trim()
                ? item.text.trim()
                : typeof item.title === "string" && item.title.trim()
                ? item.title.trim()
                : typeof item.value === "string" && item.value.trim()
                ? item.value.trim()
                : "";
            if (!text) return null;
            const id =
              typeof item.id === "string" && item.id.trim()
                ? item.id
                : createId(`gratitude-${index}`);
            return { id, text };
          }
          return null;
        })
        .filter((item) => item !== null);
    }
    if (typeof value === "string") {
      return value
        .split(/[\n,]/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
        .map((text, index) => ({ id: createId(`gratitude-${index}`), text }));
    }
  }
  return [];
}

function extractNote(entry) {
  const fields = ["note", "notes", "memo", "reflection", "summary"];
  for (const field of fields) {
    if (!entry[field]) continue;
    const value = entry[field];
    if (typeof value === "string") {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join("\n");
    }
  }
  return "";
}

function calculateStreak(list) {
  if (!list.length) return { current: 0, longest: 0 };
  const uniqueDates = Array.from(new Set(list.map((entry) => entry.date)))
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);

  if (!uniqueDates.length) return { current: 0, longest: 0 };

  let longest = 1;
  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i += 1) {
    const prev = uniqueDates[i - 1];
    const current = uniqueDates[i];
    const diff = Math.round((current - prev) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak += 1;
    } else if (diff > 1) {
      streak = 1;
    }
    if (streak > longest) {
      longest = streak;
    }
  }

  let currentStreak = 1;
  for (let i = uniqueDates.length - 1; i > 0; i -= 1) {
    const current = uniqueDates[i];
    const prev = uniqueDates[i - 1];
    const diff = Math.round((current - prev) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const lastDate = uniqueDates[uniqueDates.length - 1];
  const today = new Date();
  const daysFromLast = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
  if (daysFromLast > 1) {
    currentStreak = 0;
  }

  return { current: currentStreak, longest };
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
