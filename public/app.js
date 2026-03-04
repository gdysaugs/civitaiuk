const state = {
  includeNsfw: false,
  threads: [],
  activeThreadId: null,
  activeThread: null,
  activePosts: []
};

const ui = {
  nsfwToggle: document.querySelector("#nsfwToggle"),
  refreshBtn: document.querySelector("#refreshBtn"),
  threadForm: document.querySelector("#threadForm"),
  replyForm: document.querySelector("#replyForm"),
  threadsEl: document.querySelector("#threads"),
  detailEl: document.querySelector("#threadDetail"),
  activeMeta: document.querySelector("#activeThreadMeta"),
  threadItemTemplate: document.querySelector("#threadItemTemplate")
};

function formatDate(input) {
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
  const res = await fetch(path, {
    headers: {
      "content-type": "application/json"
    },
    ...options
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
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
    node.querySelector(".type").textContent = thread.mediaType;
    node.querySelector(".type").classList.toggle("nsfw", thread.nsfw === 1);

    const model = thread.modelName ? `model: ${thread.modelName}` : "model: -";
    node.querySelector(".model").textContent = model;
    node.querySelector(".count").textContent = `${thread.postCount} posts`;
    node.querySelector(".updated").textContent = formatDate(thread.updatedAt);

    node.addEventListener("click", () => loadThread(thread.id));
    ui.threadsEl.appendChild(node);
  }
}

function postHtml(post) {
  const prompt = post.prompt ? `<div class="prompt">${escapeHtml(post.prompt)}</div>` : "";
  const media = post.mediaUrl
    ? `<div><a class="media-link" href="${escapeAttr(post.mediaUrl)}" target="_blank" rel="noopener">${escapeHtml(post.mediaUrl)}</a></div>`
    : "";

  return `
    <article class="post">
      <div class="meta">#${post.id} by ${escapeHtml(post.authorName)} | ${formatDate(post.createdAt)}${post.nsfw ? " | NSFW" : ""}</div>
      <div class="body">${escapeHtml(post.body)}</div>
      ${media}
      ${prompt}
    </article>
  `;
}

function renderDetail() {
  if (!state.activeThread) {
    ui.activeMeta.textContent = "Select a thread";
    ui.replyForm.classList.add("hidden");
    ui.detailEl.innerHTML = "No thread selected.";
    return;
  }

  const t = state.activeThread;
  ui.activeMeta.textContent = `Thread #${t.id} | ${t.mediaType} | updated ${formatDate(t.updatedAt)}`;
  ui.replyForm.classList.remove("hidden");
  ui.replyForm.elements.threadId.value = String(t.id);

  const posts = state.activePosts.map(postHtml).join("");
  ui.detailEl.innerHTML = `
    <h3 class="detail-title">${escapeHtml(t.title)}</h3>
    <p class="meta">by ${escapeHtml(t.authorName)}${t.modelName ? ` | model: ${escapeHtml(t.modelName)}` : ""}${t.nsfw ? " | NSFW" : ""}</p>
    <section class="posts">${posts || '<div class="empty">No posts.</div>'}</section>
  `;
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
  }
  payload.nsfw = fd.get("nsfw") === "on";
  return payload;
}

async function onCreateThread(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const btn = form.querySelector("button[type='submit']");
  try {
    btn.disabled = true;
    const payload = formToPayload(form);
    const data = await request("/api/threads", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.reset();
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
    await request("/api/posts", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.elements.body.value = "";
    form.elements.prompt.value = "";
    form.elements.mediaUrl.value = "";
    form.elements.nsfw.checked = false;
    await loadThread(Number(payload.threadId));
    await loadThreads();
  } catch (error) {
    alert(error.message);
  } finally {
    btn.disabled = false;
  }
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

  ui.threadForm.addEventListener("submit", onCreateThread);
  ui.replyForm.addEventListener("submit", onReply);
}

(async function init() {
  bindEvents();
  try {
    await loadThreads();
  } catch (error) {
    ui.threadsEl.innerHTML = `<div class="card error">${escapeHtml(error.message)}</div>`;
  }
})();