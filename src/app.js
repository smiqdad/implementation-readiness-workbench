import {applyDecision, evaluateProject} from "./engine.js";

const state = {
  data: null,
  filter: "all",
  selectedId: null
};

const statusLabels = {
  ready: "Ready",
  blocked: "Blocked",
  needs_review: "Needs review",
  approved_exception: "Approved exception",
  approval_required: "Approval required",
  ready_for_launch: "Ready for launch"
};

async function init() {
  const response = await fetch("./data/project.json");
  state.data = await response.json();
  bindNavigation();
  render();
}

function bindNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const view = button.dataset.view;
      document.querySelector("#readiness-view").hidden = view !== "readiness";
      document.querySelector("#audit-view").hidden = view !== "audit";
    });
  });
  document.querySelector("#filter").addEventListener("change", (event) => {
    state.filter = event.target.value;
    renderTable();
  });
  document.querySelector("#drawer-close").addEventListener("click", closeDrawer);
  document.querySelector("#drawer-backdrop").addEventListener("click", closeDrawer);
}

function render() {
  const evaluation = evaluateProject(state.data);
  renderHeader(evaluation);
  renderSummary(evaluation);
  renderTable(evaluation);
  renderAudit();
  if (state.selectedId) renderDrawer(state.selectedId);
}

function renderHeader(evaluation) {
  const project = evaluation.project;
  document.querySelector("#project-name").textContent = `${project.customer} implementation`;
  document.querySelector("#project-meta").textContent = `${project.id} · ${project.region} · Target ${formatDate(project.target_launch_date)}`;
  const badge = document.querySelector("#launch-badge");
  badge.className = `status-pill ${evaluation.launch_status}`;
  badge.textContent = statusLabels[evaluation.launch_status] ?? evaluation.launch_status;
}

function renderSummary(evaluation) {
  const cards = [
    ["Launch status", statusLabels[evaluation.launch_status], evaluation.launch_status],
    ["Ready", String(evaluation.counts.ready + evaluation.counts.approved_exception), "ready"],
    ["Blocked", String(evaluation.counts.blocked), "blocked"],
    ["Needs review", String(evaluation.counts.needs_review), "needs_review"]
  ];
  document.querySelector("#summary-cards").innerHTML = cards.map(([label, value, tone]) => `
    <article class="summary-card">
      <span>${escapeHtml(label)}</span>
      <strong class="${tone}">${escapeHtml(value)}</strong>
    </article>
  `).join("");
  const progress = Math.round((evaluation.resolved / evaluation.total) * 100);
  document.querySelector("#progress-label").textContent = `${evaluation.resolved} of ${evaluation.total} requirements resolved`;
  document.querySelector("#progress-bar").style.width = `${progress}%`;
  document.querySelector("#progress-value").textContent = `${progress}%`;
}

function renderTable(evaluation = evaluateProject(state.data)) {
  const items = state.filter === "all"
    ? evaluation.items
    : evaluation.items.filter((item) => item.status === state.filter);
  const body = document.querySelector("#requirements-body");
  body.innerHTML = items.map((item) => `
    <tr tabindex="0" data-requirement="${item.id}" aria-label="Open ${escapeHtml(item.label)} details">
      <td><span class="area-label">${escapeHtml(item.area)}</span><strong>${escapeHtml(item.label)}</strong></td>
      <td>${valueCell(item.desired_value)}</td>
      <td>${valueCell(item.live_value)}</td>
      <td><span class="status-pill ${item.status}">${statusLabels[item.status]}</span></td>
      <td><span class="owner">${escapeHtml(item.owner)}</span><span class="next-action">${escapeHtml(item.next_action)}</span></td>
      <td><button class="row-action" data-open="${item.id}" aria-label="Review ${escapeHtml(item.label)}">Review</button></td>
    </tr>
  `).join("");
  document.querySelector("#visible-count").textContent = `${items.length} requirements`;
  body.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDrawer(button.dataset.open);
  }));
  body.querySelectorAll("tr[data-requirement]").forEach((row) => {
    row.addEventListener("click", () => openDrawer(row.dataset.requirement));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openDrawer(row.dataset.requirement);
    });
  });
}

function openDrawer(id) {
  state.selectedId = id;
  renderDrawer(id);
  document.querySelector("#drawer").classList.add("open");
  document.querySelector("#drawer").setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  state.selectedId = null;
  document.querySelector("#drawer").classList.remove("open");
  document.querySelector("#drawer").setAttribute("aria-hidden", "true");
}

function renderDrawer(id) {
  const evaluation = evaluateProject(state.data);
  const item = evaluation.items.find((candidate) => candidate.id === id);
  if (!item) return;
  const evidence = state.data.evidence.filter((entry) => item.evidence_ids.includes(entry.id));
  document.querySelector("#drawer-content").innerHTML = `
    <div class="drawer-kicker">${escapeHtml(item.area)} · ${item.id}</div>
    <div class="drawer-title-row">
      <h2>${escapeHtml(item.label)}</h2>
      <span class="status-pill ${item.status}">${statusLabels[item.status]}</span>
    </div>
    <p class="reason">${escapeHtml(item.reason)}</p>
    <div class="comparison-grid">
      <div><span>Desired state</span><strong>${escapeHtml(item.desired_value || "Not supplied")}</strong></div>
      <div><span>Live state</span><strong>${escapeHtml(item.live_value || "Not configured")}</strong></div>
    </div>
    <section class="drawer-section">
      <h3>Exception ownership</h3>
      <dl class="metadata-list">
        <div><dt>Owner</dt><dd>${escapeHtml(item.owner)}</dd></div>
        <div><dt>Next action</dt><dd>${escapeHtml(item.next_action)}</dd></div>
        <div><dt>Consequential</dt><dd>${item.consequential ? "Yes" : "No"}</dd></div>
      </dl>
    </section>
    <section class="drawer-section">
      <h3>Evidence</h3>
      ${evidence.length ? evidence.map((entry) => `
        <article class="evidence-card">
          <div><span>${escapeHtml(entry.type)}</span><time>${formatDate(entry.captured_at)}</time></div>
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.summary)}</p>
          <small>Source: ${escapeHtml(entry.source)}</small>
        </article>
      `).join("") : '<p class="empty-state">Required evidence has not been attached.</p>'}
    </section>
    ${item.latest_approval ? `
      <section class="drawer-section">
        <h3>Latest decision</h3>
        <p><strong>${escapeHtml(statusLabels[item.latest_approval.decision] ?? item.latest_approval.decision)}</strong> by ${escapeHtml(item.latest_approval.reviewer)}</p>
        <p>${escapeHtml(item.latest_approval.rationale)}</p>
      </section>
    ` : ""}
    ${item.status === "needs_review" ? decisionForm(item) : ""}
  `;
  const form = document.querySelector("#decision-form");
  if (form) form.addEventListener("submit", handleDecision);
}

function decisionForm(item) {
  return `
    <form id="decision-form" class="decision-form" data-requirement="${item.id}">
      <h3>Record decision</h3>
      <label>Reviewer<input name="actor" value="Avery Chen" required></label>
      <label>Rationale<textarea name="rationale" required placeholder="Explain why this decision is safe and accountable."></textarea></label>
      <div class="decision-actions">
        <button name="decision" value="changes_requested" class="secondary-button">Request changes</button>
        <button name="decision" value="approved_exception" class="primary-button">Approve exception</button>
      </div>
    </form>
  `;
}

function handleDecision(event) {
  event.preventDefault();
  const submitter = event.submitter;
  const form = new FormData(event.currentTarget);
  try {
    state.data = applyDecision(state.data, {
      requirementId: event.currentTarget.dataset.requirement,
      decision: submitter.value,
      actor: form.get("actor"),
      rationale: form.get("rationale"),
      timestamp: new Date().toISOString()
    });
    render();
  } catch (error) {
    window.alert(error.message);
  }
}

function renderAudit() {
  const events = [...state.data.audit_log].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  document.querySelector("#audit-list").innerHTML = events.map((event) => `
    <article class="audit-event">
      <div class="audit-marker"></div>
      <div>
        <div class="audit-heading"><strong>${escapeHtml(event.action.replaceAll("_", " "))}</strong><time>${formatDateTime(event.timestamp)}</time></div>
        <p>${escapeHtml(event.detail)}</p>
        <small>${escapeHtml(event.actor)} · ${escapeHtml(event.object_id)}</small>
      </div>
    </article>
  `).join("");
}

function valueCell(value) {
  return value ? `<span class="configured-value">${escapeHtml(value)}</span>` : '<span class="missing-value">Not configured</span>';
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IE", {day: "numeric", month: "short", year: "numeric"}).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IE", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"})[character]);
}

init().catch((error) => {
  document.querySelector("#app").innerHTML = `<p class="load-error">Unable to load the fictional project: ${escapeHtml(error.message)}</p>`;
});
