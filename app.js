const STORAGE_KEY = "goals-tracker.goals";

/** @typedef {{id: string, title: string, description: string, category: string, dueDate: string, progress: number, completed: boolean, createdAt: string}} Goal */

/** @returns {Goal[]} */
function loadGoals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** @param {Goal[]} goals */
function saveGoals(goals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

let goals = loadGoals();
let currentFilter = "all";

const form = document.getElementById("goal-form");
const titleInput = document.getElementById("goal-title");
const descriptionInput = document.getElementById("goal-description");
const categoryInput = document.getElementById("goal-category");
const dueInput = document.getElementById("goal-due");
const listEl = document.getElementById("goal-list");
const emptyState = document.getElementById("empty-state");
const filterButtons = document.querySelectorAll(".filter-btn");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  goals.push({
    id: crypto.randomUUID(),
    title,
    description: descriptionInput.value.trim(),
    category: categoryInput.value,
    dueDate: dueInput.value,
    progress: 0,
    completed: false,
    createdAt: new Date().toISOString(),
  });

  saveGoals(goals);
  form.reset();
  render();
});

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    render();
  });
});

function updateProgress(id, value) {
  const goal = goals.find((g) => g.id === id);
  if (!goal) return;
  goal.progress = Math.max(0, Math.min(100, Number(value)));
  if (goal.progress === 100) goal.completed = true;
  else if (goal.completed) goal.completed = false;
  saveGoals(goals);
  render();
}

function toggleComplete(id) {
  const goal = goals.find((g) => g.id === id);
  if (!goal) return;
  goal.completed = !goal.completed;
  goal.progress = goal.completed ? 100 : goal.progress;
  saveGoals(goals);
  render();
}

function deleteGoal(id) {
  goals = goals.filter((g) => g.id !== id);
  saveGoals(goals);
  render();
}

function dueTag(goal) {
  if (!goal.dueDate) return "";
  const due = new Date(goal.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = due < today && !goal.completed;
  const label = due.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `<span class="tag ${isOverdue ? "overdue" : "due"}">${isOverdue ? "Overdue: " : "Due "}${label}</span>`;
}

function goalCard(goal) {
  const li = document.createElement("li");
  li.className = "goal-card" + (goal.completed ? " completed" : "");
  li.innerHTML = `
    <div class="goal-card-top">
      <div>
        <p class="goal-title"></p>
        <p class="goal-description"></p>
      </div>
    </div>
    <div class="goal-meta">
      <span class="tag"></span>
      ${dueTag(goal)}
    </div>
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill" style="width:${goal.progress}%"></div></div>
      <input type="number" class="progress-input" min="0" max="100" value="${goal.progress}">
      <span>%</span>
    </div>
    <div class="goal-actions">
      <button class="complete-btn">${goal.completed ? "Mark Active" : "Mark Complete"}</button>
      <button class="delete-btn">Delete</button>
    </div>
  `;

  li.querySelector(".goal-title").textContent = goal.title;
  const descEl = li.querySelector(".goal-description");
  if (goal.description) {
    descEl.textContent = goal.description;
  } else {
    descEl.remove();
  }
  li.querySelector(".goal-meta .tag").textContent = goal.category;

  li.querySelector(".progress-input").addEventListener("change", (e) => updateProgress(goal.id, e.target.value));
  li.querySelector(".complete-btn").addEventListener("click", () => toggleComplete(goal.id));
  li.querySelector(".delete-btn").addEventListener("click", () => deleteGoal(goal.id));

  return li;
}

function filteredGoals() {
  if (currentFilter === "active") return goals.filter((g) => !g.completed);
  if (currentFilter === "completed") return goals.filter((g) => g.completed);
  return goals;
}

function render() {
  const visible = filteredGoals();
  listEl.innerHTML = "";
  visible.forEach((goal) => listEl.appendChild(goalCard(goal)));
  emptyState.style.display = goals.length === 0 ? "block" : "none";

  document.getElementById("stat-total").textContent = goals.length;
  document.getElementById("stat-active").textContent = goals.filter((g) => !g.completed).length;
  document.getElementById("stat-done").textContent = goals.filter((g) => g.completed).length;
}

render();
