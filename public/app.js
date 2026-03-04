const state = {
  includeNsfw: false,
  threads: [],
  activeThreadId: null,
  activeThread: null,
  activePosts: [],
  config: {
    appName: "civitai.uk",
    turnstileSiteKey: null,
    turnstileRequired: false,
    uploadsEnabled: false,
    maxUploadBytes: 25 * 1024 * 1024
  },
  turnstile: {
    scriptLoaded: false,
    widgets: {},
    tokens: {}
  }
};

const ui = {
  nsfwToggle: document.querySelector("#nsfwToggle"),
  refreshBtn: document.querySelector("#refreshBtn"),
  threadForm: document.querySelector("#threadForm"),
  replyForm: document.querySelector("#replyForm"),
  reportForm: document.querySelector("#reportForm"),
  reportTarget: document.querySelector("#reportTarget"),
  cancelReportBtn: document.querySelector("#cancelReportBtn"),
  reportThreadBtn: document.querySelector("#reportThreadBtn"),
  runtimeInfo: document.querySelector("#runtimeInfo"),
  threadsEl: document.querySelector("#threads"),
  detailEl: document.querySelector("#threadDetail"),
  activeMeta: document.querySelector("#activeThreadMeta"),
  threadItemTemplate: document.querySelector("#threadItemTemplate"),
  uploadButtons: document.querySelectorAll(".upload-btn")
};

function formatDate(input) {
  if (!input) return "-";
  const d = new Date(`${input}Z`);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString();
}

function apiUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(path, {
    ...options,
    headers
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => "");

  if (!res.ok) {
    const message = typeof body === "object" && body?.error ? body.error : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(str = "") {
  return escapeHtml(str);
}

function guessMediaKind(url, mimeType) {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";

  const lower = (url || "").toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|avif)(\?|#|$)/.test(lower)) return "image";
  if (/\.(mp4|webm|mov|m4v|mkv)(\?|#|$)/.test(lower)) return "video";
  return "link";
}

function renderMedia(post) {
  if (!post.mediaUrl) return "";

  const kind = guessMediaKind(post.mediaUrl, post.mediaMime);
  const safeUrl = escapeAttr(post.mediaUrl);

  if (kind === "image") {
    return `
      <div class="media-preview">
        <a class="media-link" href="${safeUrl}" target="_blank" rel="noopener">
          <img src="${safeUrl}" loading="lazy" alt="uploaded media" />
        </a>
      </div>
    `;
  }

  if (kind === "video") {
    return `
      <div class="media-preview">
        <video controls preload="metadata" src="${safeUrl}"></video>
      </div>
    `;
  }

  return `<div><a class="media-link" href="${safeUrl}" target="_blank" rel="noopener">${escapeHtml(post.mediaUrl)}</a></div>`;
}

function postHtml(post) {
  const prompt = post.prompt ? `<div class="prompt">${escapeHtml(post.prompt)}</div>` : "";
  const media = renderMedia(post);

  return `
    <article class="post">
      <div class="meta">#${post.id} by ${escapeHtml(post.authorName)} | ${formatDate(post.createdAt)}${post.nsfw ? " | NSFW" : ""}</div>
      <div class="body">${escapeHtml(post.body)}</div>
      ${media}
      ${prompt}
      <div class="post-actions">
        <button class="btn danger report-post-btn" data-post-id="${post.id}" type="button">Report Post</button>
      </div>
    </article>
  `;
}

function renderThreads() {
  ui.threadsEl.innerHTML = "";

  if (state.threads.length === 0) {
    ui.threadsEl.innerHTML = `<div class="card empty">No threads yet.</div>`;
    return;
  }

  for (const thread of state.threads) {
    const node = ui.threadItemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = String(thread.id);
    if (state.activeThreadId === thread.id) node.classList.add("active");

    node.querySelector(".title").textContent = thread.title;
    const typeLabel = thread.isLocked ? `${thread.mediaType} | locked` : thread.mediaType;
    node.querySelector(".type").textContent = typeLabel;
    node.querySelector(".type").classList.toggle("nsfw", thread.nsfw === 1);
    node.querySelector(".type").classList.toggle("locked", thread.isLocked === 1);

    const model = thread.modelName ? `model: ${thread.modelName}` : "model: -";
    node.querySelector(".model").textContent = model;
    node.querySelector(".count").textContent = `${thread.postCount} posts`;
    node.querySelector(".updated").textContent = formatDate(thread.updatedAt);

    node.addEventListener("click", () => {
      loadThread(thread.id).catch((error) => alert(error.message));
    });
    ui.threadsEl.appendChild(node);
  }
}

function closeReportForm() {
  ui.reportForm.classList.add("hidden");
  ui.reportForm.reset();
  if (ui.reportForm.elements.threadId) ui.reportForm.elements.threadId.value = "";
  if (ui.reportForm.elements.postId) ui.reportForm.elements.postId.value = "";
  ui.reportTarget.textContent = "";
}

function openReportForm(target) {
  ui.reportForm.classList.remove("hidden");
  ui.reportForm.elements.threadId.value = target.threadId ? String(target.threadId) : "";
  ui.reportForm.elements.postId.value = target.postId ? String(target.postId) : "";

  ui.reportTarget.textContent = target.postId
    ? `Reporting post #${target.postId} in thread #${target.threadId}`
    : `Reporting thread #${target.threadId}`;
}

function renderDetail() {
  if (!state.activeThread) {
    ui.activeMeta.textContent = "Select a thread";
    ui.replyForm.classList.add("hidden");
    ui.reportThreadBtn.classList.add("hidden");
    closeReportForm();
    ui.detailEl.innerHTML = "No thread selected.";
    return;
  }

  const t = state.activeThread;
  ui.activeMeta.textContent = `Thread #${t.id} | ${t.mediaType} | updated ${formatDate(t.updatedAt)}${t.isLocked ? " | locked" : ""}`;
  ui.reportThreadBtn.classList.remove("hidden");

  if (t.isLocked) {
    ui.replyForm.classList.add("hidden");
  } else {
    ui.replyForm.classList.remove("hidden");
    ui.replyForm.elements.threadId.value = String(t.id);
  }

  const posts = state.activePosts.map(postHtml).join("");
  ui.detailEl.innerHTML = `
    <h3 class="detail-title">${escapeHtml(t.title)}</h3>
    <p class="meta">by ${escapeHtml(t.authorName)}${t.modelName ? ` | model: ${escapeHtml(t.modelName)}` : ""}${t.nsfw ? " | NSFW" : ""}${t.isLocked ? " | locked" : ""}</p>
    <section class="posts">${posts || '<div class="empty">No posts.</div>'}</section>
  `;
}

async function loadConfig() {
  const data = await request("/api/config");
  state.config = {
    ...state.config,
    ...data
  };

  const uploadMb = (state.config.maxUploadBytes / (1024 * 1024)).toFixed(1);
  ui.runtimeInfo.textContent = `upload:${state.config.uploadsEnabled ? "on" : "off"} | turnstile:${state.config.turnstileSiteKey ? "configured" : "off"} | max:${uploadMb}MB`;

  for (const button of ui.uploadButtons) {
    if (!state.config.uploadsEnabled) {
      button.disabled = true;
      button.title = "R2 binding MEDIA is not configured.";
    }
  }
}

async function loadTurnstileScript() {
  if (state.turnstile.scriptLoaded || window.turnstile) {
    state.turnstile.scriptLoaded = true;
    return;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile script."));
    document.head.appendChild(script);
  });

  state.turnstile.scriptLoaded = true;
}

async function setupTurnstile() {
  const siteKey = state.config.turnstileSiteKey;
  const slots = document.querySelectorAll(".turnstile-slot");

  if (!siteKey) {
    for (const slot of slots) slot.classList.add("hidden");
    return;
  }

  await loadTurnstileScript();
  for (const slot of slots) slot.classList.remove("hidden");

  for (const slot of slots) {
    const name = slot.dataset.turnstile;
    if (!name) continue;
    if (state.turnstile.widgets[name] !== undefined) continue;

    const widgetId = window.turnstile.render(slot, {
      sitekey: siteKey,
      callback: (token) => {
        state.turnstile.tokens[name] = token;
      },
      "expired-callback": () => {
        state.turnstile.tokens[name] = null;
      },
      "error-callback": () => {
        state.turnstile.tokens[name] = null;
      }
    });

    state.turnstile.widgets[name] = widgetId;
    state.turnstile.tokens[name] = null;
  }
}

function readTurnstileToken(name) {
  if (!state.config.turnstileSiteKey) return null;
  const token = state.turnstile.tokens[name];
  if (!token) throw new Error("Turnstile verification is required.");
  return token;
}

function resetTurnstile(name) {
  const widgetId = state.turnstile.widgets[name];
  if (widgetId === undefined || !window.turnstile) return;
  window.turnstile.reset(widgetId);
  state.turnstile.tokens[name] = null;
}

async function loadThreads() {
  const params = {
    limit: 100,
    nsfw: state.includeNsfw ? "include" : ""
  };

  const data = await request(apiUrl("/api/threads", params));
  state.threads = data.threads || [];

  if (state.activeThreadId && !state.threads.find((t) => t.id === state.activeThreadId)) {
    state.activeThreadId = null;
    state.activeThread = null;
    state.activePosts = [];
  }

  renderThreads();
  renderDetail();
}

async function loadThread(threadId) {
  const params = {
    nsfw: state.includeNsfw ? "include" : "",
    postLimit: 300
  };
  const data = await request(apiUrl(`/api/threads/${threadId}`, params));
  state.activeThreadId = threadId;
  state.activeThread = data.thread;
  state.activePosts = data.posts || [];
  renderThreads();
  renderDetail();
}

function formToPayload(form) {
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());

  for (const key of Object.keys(payload)) {
    if (typeof payload[key] === "string") payload[key] = payload[key].trim();
    if (payload[key] === "") payload[key] = undefined;
  }

  payload.nsfw = fd.get("nsfw") === "on";
  return payload;
}

async function uploadFor(formName) {
  const form = formName === "thread" ? ui.threadForm : ui.replyForm;
  const fileInput = form.elements.mediaFile;
  const file = fileInput?.files?.[0];
  if (!file) throw new Error("Choose a file first.");

  const formData = new FormData();
  formData.set("file", file);

  const result = await request("/api/media/upload", {
    method: "POST",
    body: formData
  });

  form.elements.mediaUrl.value = result.mediaUrl || "";
  form.elements.mediaMime.value = result.mimeType || "";
  fileInput.value = "";
}

async function onCreateThread(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const btn = form.querySelector("button[type='submit']");

  try {
    btn.disabled = true;
    const payload = formToPayload(form);
    payload.turnstileToken = readTurnstileToken("thread");

    const data = await request("/api/threads", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    form.reset();
    resetTurnstile("thread");
    await loadThreads();
    if (data.thread?.id) await loadThread(data.thread.id);
  } catch (error) {
    alert(error.message);
  } finally {
    btn.disabled = false;
  }
}

async function onReply(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const btn = form.querySelector("button[type='submit']");

  try {
    btn.disabled = true;
    const payload = formToPayload(form);
    payload.threadId = Number(payload.threadId);
    payload.turnstileToken = readTurnstileToken("reply");

    await request("/api/posts", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    form.elements.body.value = "";
    form.elements.prompt.value = "";
    form.elements.mediaUrl.value = "";
    form.elements.mediaMime.value = "";
    form.elements.nsfw.checked = false;
    resetTurnstile("reply");

    await loadThread(Number(payload.threadId));
    await loadThreads();
  } catch (error) {
    alert(error.message);
  } finally {
    btn.disabled = false;
  }
}

async function onReport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const btn = form.querySelector("button[type='submit']");

  try {
    btn.disabled = true;
    const payload = formToPayload(form);
    payload.threadId = payload.threadId ? Number(payload.threadId) : undefined;
    payload.postId = payload.postId ? Number(payload.postId) : undefined;
    payload.turnstileToken = readTurnstileToken("report");

    await request("/api/reports", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    alert("Report has been submitted.");
    closeReportForm();
    resetTurnstile("report");
  } catch (error) {
    alert(error.message);
  } finally {
    btn.disabled = false;
  }
}

function bindEvents() {
  ui.nsfwToggle.addEventListener("change", async () => {
    state.includeNsfw = ui.nsfwToggle.checked;
    await loadThreads();
    if (state.activeThreadId) {
      try {
        await loadThread(state.activeThreadId);
      } catch {
        state.activeThreadId = null;
        state.activeThread = null;
        state.activePosts = [];
        renderThreads();
        renderDetail();
      }
    }
  });

  ui.refreshBtn.addEventListener("click", async () => {
    await loadThreads();
    if (state.activeThreadId) await loadThread(state.activeThreadId);
  });

  for (const button of ui.uploadButtons) {
    button.addEventListener("click", async () => {
      const formName = button.dataset.uploadFor;
      if (formName !== "thread" && formName !== "reply") return;
      try {
        button.disabled = true;
        await uploadFor(formName);
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  ui.threadForm.addEventListener("submit", onCreateThread);
  ui.replyForm.addEventListener("submit", onReply);
  ui.reportForm.addEventListener("submit", onReport);

  ui.reportThreadBtn.addEventListener("click", () => {
    if (!state.activeThread) return;
    openReportForm({ threadId: state.activeThread.id, postId: null });
  });

  ui.cancelReportBtn.addEventListener("click", () => {
    closeReportForm();
  });

  ui.detailEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest(".report-post-btn");
    if (!button) return;

    const postId = Number(button.getAttribute("data-post-id"));
    if (!Number.isInteger(postId) || postId <= 0 || !state.activeThread) return;

    openReportForm({ threadId: state.activeThread.id, postId });
  });
}

(async function init() {
  bindEvents();
  try {
    await loadConfig();
    await setupTurnstile();
    await loadThreads();
  } catch (error) {
    ui.threadsEl.innerHTML = `<div class="card error">${escapeHtml(error.message)}</div>`;
  }
})();
