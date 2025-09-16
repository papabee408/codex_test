const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
const STORAGE_KEY = "daily-planner-entries-v1";
const periodLabels = {
  morning: "아침",
  afternoon: "점심",
  evening: "저녁",
  night: "밤"
};
const periodSortOrder = {
  morning: 8 * 60,
  afternoon: 13 * 60,
  evening: 18 * 60,
  night: 21 * 60
};
const periodIcons = {
  morning: "🌅",
  afternoon: "🌞",
  evening: "🌇",
  night: "🌙"
};
const ratingText = {
  1: "아쉬워요",
  2: "조금 부족해요",
  3: "보통",
  4: "좋았어요",
  5: "최고였어요"
};

const calendarEl = document.getElementById("calendar");
const currentMonthEl = document.getElementById("currentMonth");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const todayButton = document.getElementById("todayButton");
const selectedDateTitle = document.getElementById("selectedDateTitle");
const taskForm = document.getElementById("taskForm");
const taskTitleInput = document.getElementById("taskTitle");
const segmentTypeSelect = document.getElementById("segmentType");
const periodGroup = document.getElementById("periodGroup");
const timeGroup = document.getElementById("timeGroup");
const taskPeriodSelect = document.getElementById("taskPeriod");
const taskTimeInput = document.getElementById("taskTime");
const taskListEl = document.getElementById("taskList");
const taskTemplate = document.getElementById("taskItemTemplate");
const reflectionForm = document.getElementById("reflectionForm");
const dayRatingInput = document.getElementById("dayRating");
const ratingLabel = document.getElementById("ratingLabel");
const daySummaryInput = document.getElementById("daySummary");
const gratitudeInput = document.getElementById("gratitude");
const saveStatusEl = document.getElementById("saveStatus");

let entries = loadEntries();
let currentMonth = startOfMonth(new Date());
let selectedDate = startOfDay(new Date());
let saveStatusTimeoutId;

init();

function init() {
  renderCalendar();
  updateDayPanel();
  updateSegmentFields();
  if (!taskTimeInput.value) {
    taskTimeInput.value = "09:00";
  }
  attachEventListeners();
}

function attachEventListeners() {
  prevMonthBtn.addEventListener("click", () => {
    currentMonth = addMonths(currentMonth, -1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    currentMonth = addMonths(currentMonth, 1);
    renderCalendar();
  });

  todayButton.addEventListener("click", () => {
    selectDate(new Date());
  });

  segmentTypeSelect.addEventListener("change", updateSegmentFields);

  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = taskTitleInput.value.trim();
    if (!title) {
      taskTitleInput.focus();
      return;
    }

    const segmentType = segmentTypeSelect.value;
    const newTask = {
      id: generateId(),
      title,
      segmentType,
      completed: false
    };

    if (segmentType === "customTime") {
      newTask.time = taskTimeInput.value || "09:00";
    } else {
      newTask.period = taskPeriodSelect.value || "morning";
    }

    const dateKey = formatDate(selectedDate);
    const entry = ensureEntry(dateKey);
    entry.tasks.push(newTask);
    saveEntries();

    taskForm.reset();
    segmentTypeSelect.value = "period";
    taskTimeInput.value = "09:00";
    updateSegmentFields();
    taskTitleInput.focus();

    renderTasks();
    renderCalendar();
  });

  dayRatingInput.addEventListener("input", () => {
    updateRatingLabel();
  });

  reflectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const dateKey = formatDate(selectedDate);
    const entry = ensureEntry(dateKey);
    entry.reflection = {
      rating: Number(dayRatingInput.value),
      summary: daySummaryInput.value.trim(),
      gratitude: gratitudeInput.value.trim()
    };
    saveEntries();
    showSaveStatus("기록이 저장되었습니다");
    renderCalendar();
  });
}

function renderCalendar() {
  calendarEl.innerHTML = "";

  dayNames.forEach((name) => {
    const dayNameEl = document.createElement("div");
    dayNameEl.className = "day-name";
    dayNameEl.textContent = name;
    calendarEl.appendChild(dayNameEl);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  currentMonthEl.textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = 42;

  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(year, month, 1 + i - startDayOfWeek);
    const isCurrentMonth = cellDate.getMonth() === month;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";
    if (!isCurrentMonth) {
      cell.classList.add("other-month");
    }

    if (isSameDay(cellDate, new Date())) {
      cell.classList.add("today");
    }

    if (isSameDay(cellDate, selectedDate)) {
      cell.classList.add("selected");
    }

    const dayNumberEl = document.createElement("div");
    dayNumberEl.className = "day-number";
    dayNumberEl.textContent = cellDate.getDate();
    cell.appendChild(dayNumberEl);

    const indicatorsWrapper = document.createElement("div");
    indicatorsWrapper.className = "indicators";
    const dateKey = formatDate(cellDate);
    const entry = entries[dateKey];
    if (entry) {
      if (Array.isArray(entry.tasks) && entry.tasks.length > 0) {
        const taskIndicator = document.createElement("span");
        taskIndicator.className = "indicator task";
        indicatorsWrapper.appendChild(taskIndicator);
      }
      if (hasReflection(entry)) {
        const reflectionIndicator = document.createElement("span");
        reflectionIndicator.className = "indicator reflection";
        indicatorsWrapper.appendChild(reflectionIndicator);
      }
    }

    if (indicatorsWrapper.childElementCount > 0) {
      cell.appendChild(indicatorsWrapper);
    }

    const accessibleLabel = `${cellDate.getFullYear()}년 ${cellDate.getMonth() + 1}월 ${cellDate.getDate()}일`;
    const labelParts = [accessibleLabel];
    if (entry) {
      if (Array.isArray(entry.tasks) && entry.tasks.length > 0) {
        labelParts.push(`할일 ${entry.tasks.length}개`);
      }
      if (hasReflection(entry)) {
        labelParts.push("회고/감사 기록 있음");
      }
    }
    cell.setAttribute("aria-label", labelParts.join(", "));

    cell.addEventListener("click", () => {
      selectDate(cellDate);
    });

    calendarEl.appendChild(cell);
  }
}

function selectDate(date) {
  selectedDate = startOfDay(date);
  currentMonth = startOfMonth(selectedDate);
  renderCalendar();
  updateDayPanel();
}

function updateDayPanel() {
  selectedDateTitle.textContent = formatKoreanDate(selectedDate);
  renderTasks();
  populateReflectionForm();
}

function renderTasks() {
  const dateKey = formatDate(selectedDate);
  const entry = entries[dateKey];
  const tasks = entry && Array.isArray(entry.tasks) ? entry.tasks : [];

  if (tasks.length === 0) {
    taskListEl.classList.add("empty-state");
    taskListEl.innerHTML = "<p>아직 작성한 할일이 없어요. 계획을 추가해보세요!</p>";
    return;
  }

  taskListEl.classList.remove("empty-state");
  taskListEl.innerHTML = "";

  const sortedTasks = sortTasks(tasks);
  sortedTasks.forEach((task) => {
    const taskElement = taskTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = taskElement.querySelector(".task-complete");
    const titleEl = taskElement.querySelector(".task-title");
    const metaEl = taskElement.querySelector(".task-meta");
    const deleteButton = taskElement.querySelector(".delete-task");

    checkbox.checked = Boolean(task.completed);
    titleEl.textContent = task.title;
    metaEl.textContent = getTaskMetaLabel(task);

    if (task.completed) {
      taskElement.classList.add("completed");
    }

    checkbox.addEventListener("change", (event) => {
      toggleTaskCompletion(dateKey, task.id, event.target.checked);
    });

    deleteButton.addEventListener("click", () => {
      deleteTask(dateKey, task.id);
    });

    taskListEl.appendChild(taskElement);
  });
}

function sortTasks(tasks) {
  return tasks.slice().sort((a, b) => {
    const valueA = getTaskSortValue(a);
    const valueB = getTaskSortValue(b);
    if (valueA === valueB) {
      return a.title.localeCompare(b.title, "ko");
    }
    return valueA - valueB;
  });
}

function getTaskSortValue(task) {
  if (task.segmentType === "customTime") {
    const minutes = timeStringToMinutes(task.time);
    return minutes !== null ? minutes : 24 * 60;
  }
  const periodValue = periodSortOrder[task.period];
  return typeof periodValue === "number" ? periodValue : 24 * 60 + 1;
}

function timeStringToMinutes(timeString) {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function getTaskMetaLabel(task) {
  if (task.segmentType === "customTime") {
    return `🕒 ${task.time || "시간 미지정"}`;
  }
  const period = task.period;
  const label = periodLabels[period] || "기타";
  const icon = periodIcons[period] || "🗓";
  return `${icon} ${label}`;
}

function toggleTaskCompletion(dateKey, taskId, completed) {
  const entry = entries[dateKey];
  if (!entry) return;
  const targetTask = entry.tasks.find((task) => task.id === taskId);
  if (!targetTask) return;
  targetTask.completed = completed;
  saveEntries();
  renderTasks();
  renderCalendar();
}

function deleteTask(dateKey, taskId) {
  const entry = entries[dateKey];
  if (!entry) return;
  entry.tasks = entry.tasks.filter((task) => task.id !== taskId);
  if (entry.tasks.length === 0 && !hasReflection(entry)) {
    delete entries[dateKey];
  }
  saveEntries();
  renderTasks();
  renderCalendar();
}

function hasReflection(entry) {
  if (!entry || !entry.reflection) return false;
  const { rating, summary, gratitude } = entry.reflection;
  return Boolean(rating || summary || gratitude);
}

function populateReflectionForm() {
  const dateKey = formatDate(selectedDate);
  const entry = entries[dateKey];
  const reflection = entry && entry.reflection ? entry.reflection : {};

  const rating = reflection.rating ?? 3;
  dayRatingInput.value = rating;
  daySummaryInput.value = reflection.summary || "";
  gratitudeInput.value = reflection.gratitude || "";
  updateRatingLabel();
  clearSaveStatus();
}

function updateRatingLabel() {
  const value = Number(dayRatingInput.value);
  const label = ratingText[value] || "";
  ratingLabel.textContent = `${label} (${value})`;
}

function showSaveStatus(message) {
  clearTimeout(saveStatusTimeoutId);
  saveStatusEl.textContent = message;
  saveStatusTimeoutId = setTimeout(() => {
    clearSaveStatus();
  }, 2200);
}

function clearSaveStatus() {
  clearTimeout(saveStatusTimeoutId);
  saveStatusEl.textContent = "";
}

function updateSegmentFields() {
  if (segmentTypeSelect.value === "customTime") {
    timeGroup.classList.remove("hidden");
    periodGroup.classList.add("hidden");
  } else {
    periodGroup.classList.remove("hidden");
    timeGroup.classList.add("hidden");
  }
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return {};
  } catch (error) {
    console.error("데이터를 불러오는 중 오류가 발생했습니다", error);
    return {};
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function ensureEntry(dateKey) {
  if (!entries[dateKey]) {
    entries[dateKey] = { tasks: [], reflection: {} };
  } else {
    entries[dateKey].tasks = entries[dateKey].tasks || [];
    entries[dateKey].reflection = entries[dateKey].reflection || {};
  }
  return entries[dateKey];
}

function generateId() {
  return `${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatKoreanDate(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${dayNames[date.getDay()]})`;
}
