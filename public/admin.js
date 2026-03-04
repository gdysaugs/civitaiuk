const ui = {
  adminForm: document.querySelector("#adminForm"),
  adminToken: document.querySelector("#adminToken"),
  statusFilter: document.querySelector("#statusFilter"),
  loadReportsBtn: document.querySelector("#loadReportsBtn"),
  reportList: document.querySelector("#reportList"),
  adminMessage: document.querySelector("#adminMessage")
};

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function adminRequest(path, token, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("x-admin-token", token);
  if (!(options.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function reportCard(report) {
  const target = report.postId ? `post #${report.postId}` : `thread #${report.threadId}`;
  const createdAt = report.createdAt ? new Date(`${report.createdAt}Z`).toLocaleString() : "-";
  return `
    <article class="card">
      <p><strong>#${report.id}</strong> | ${escapeHtml(report.status)} | ${escapeHtml(target)}</p>
      <p class="meta">${escapeHtml(report.reason)} | ${escapeHtml(createdAt)}</p>
      <p>${escapeHtml(report.threadTitle || "-")}</p>
      <p>${escapeHtml(report.details || "")}</p>
      <div class="report-actions">
        <button class="btn action-btn" data-id="${report.id}" data-action="resolve_only" type="button">Resolve</button>
        <button class="btn action-btn" data-id="${report.id}" data-action="reject" type="button">Reject</button>
        <button class="btn danger action-btn" data-id="${report.id}" data-action="delete_post" type="button">Delete Post</button>
        <button class="btn danger action-btn" data-id="${report.id}" data-action="lock_thread" type="button">Lock Thread</button>
        <button class="btn danger action-btn" data-id="${report.id}" data-action="delete_thread" type="button">Delete Thread</button>
      </div>
    </article>
  `;
}

async function loadReports() {
  const token = ui.adminToken.value.trim();
  const status = ui.statusFilter.value;
  if (!token) throw new Error("Admin token is required.");

  ui.adminMessage.textContent = "Loading...";
  const data = await adminRequest(`/api/reports?status=${encodeURIComponent(status)}&limit=200`, token);
  const reports = data.reports || [];

  ui.adminMessage.textContent = `${reports.length} report(s) loaded`;
  ui.reportList.innerHTML = reports.length ? reports.map(reportCard).join("") : '<div class="card empty">No reports.</div>';
}

async function resolveReport(reportId, action) {
  const token = ui.adminToken.value.trim();
  if (!token) throw new Error("Admin token is required.");

  const note = window.prompt(`note for action "${action}"`, "") || "";
  await adminRequest(`/api/mod/reports/${reportId}/resolve`, token, {
    method: "POST",
    body: JSON.stringify({
      action,
      note
    })
  });
}

ui.adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    ui.loadReportsBtn.disabled = true;
    await loadReports();
  } catch (error) {
    ui.adminMessage.textContent = error.message;
    ui.reportList.innerHTML = "";
  } finally {
    ui.loadReportsBtn.disabled = false;
  }
});

ui.reportList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest(".action-btn");
  if (!button) return;

  const reportId = Number(button.dataset.id);
  const action = button.dataset.action;
  if (!Number.isInteger(reportId) || reportId <= 0 || !action) return;

  try {
    button.disabled = true;
    await resolveReport(reportId, action);
    await loadReports();
  } catch (error) {
    ui.adminMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
