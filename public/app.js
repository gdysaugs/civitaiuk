const state = {
  posts: [],
  pagination: {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1
  }
};

const ui = {
  list: document.querySelector("#postList"),
  template: document.querySelector("#postCardTemplate"),
  pager: document.querySelector("#pager")
};

function parsePageParam() {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("p"));
  if (Number.isInteger(page) && page > 0) return page;
  return 1;
}

function syncPageQuery() {
  const url = new URL(window.location.href);
  if (state.pagination.page > 1) {
    url.searchParams.set("p", String(state.pagination.page));
  } else {
    url.searchParams.delete("p");
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function formatDate(input) {
  if (!input) return "-";
  const date = new Date(`${input}Z`);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleString();
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message = typeof body === "object" && body?.error ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return body;
}

function guessMediaKind(url, mimeType) {
  const lower = (url || "").toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|avif)(\?|#|$)/.test(lower)) return "image";
  if (/\.(mp4|webm|mov|m4v|mkv)(\?|#|$)/.test(lower)) return "video";

  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "none";
}

function resolveCardMedia(post) {
  const thumbnail = typeof post.thumbnailUrl === "string" ? post.thumbnailUrl.trim() : "";
  if (thumbnail) return thumbnail;
  const media = typeof post.mediaUrl === "string" ? post.mediaUrl.trim() : "";
  return media;
}

function mediaHtml(post) {
  const mediaUrl = resolveCardMedia(post);
  if (!mediaUrl) {
    return '<div class="post-card-placeholder">No media</div>';
  }

  const kind = guessMediaKind(mediaUrl, post.mediaMime);
  const safeUrl = escapeHtml(mediaUrl);

  if (kind === "image") {
    return `<img src="${safeUrl}" loading="lazy" alt="post media" />`;
  }

  if (kind === "video") {
    return `<video src="${safeUrl}" muted playsinline preload="metadata"></video>`;
  }

  return '<div class="post-card-placeholder">Media</div>';
}

function makeExcerpt(text, maxLen = 180) {
  const raw = String(text || "");
  if (!raw.trim()) return "No text.";

  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bodyLines = [];
  let inToc = false;

  for (const line of lines) {
    if (/^##\s*目次\b/.test(line)) {
      inToc = true;
      continue;
    }

    if (inToc) {
      if (/^##\s+/.test(line)) {
        inToc = false;
      } else {
        continue;
      }
    }

    // Keep list card excerpts compact: skip markdown headings and bullet items.
    if (/^#{1,6}\s+/.test(line)) continue;
    if (/^- /.test(line)) continue;
    if (/^!\[[^\]]*\]\(((?:https?:\/\/|\/)[^)]+)\)$/.test(line)) continue;

    bodyLines.push(line);
  }

  const normalized = bodyLines.join(" ").replace(/\s+/g, " ").trim() || raw.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}...`;
}

function renderPosts() {
  ui.list.innerHTML = "";

  if (!state.posts.length) {
    ui.list.innerHTML = '<article class="card empty-card">No posts yet.</article>';
    return;
  }

  for (const post of state.posts) {
    const node = ui.template.content.firstElementChild.cloneNode(true);
    const button = node.querySelector(".post-card-button");

    button.dataset.id = String(post.id);
    node.querySelector(".post-card-media").innerHTML = mediaHtml(post);
    node.querySelector(".post-card-title").textContent = post.title || "Untitled";

    const author = post.authorName ? ` by ${post.authorName}` : "";
    node.querySelector(".post-card-meta").textContent = `${formatDate(post.createdAt)}${author}`;
    node.querySelector(".post-card-excerpt").textContent = makeExcerpt(post.body);

    button.addEventListener("click", () => {
      window.location.href = `/post/${post.id}`;
    });

    ui.list.appendChild(node);
  }
}

function renderPager() {
  const totalPages = state.pagination.totalPages;
  const page = state.pagination.page;

  if (totalPages <= 1) {
    ui.pager.classList.add("hidden");
    ui.pager.innerHTML = "";
    return;
  }

  ui.pager.classList.remove("hidden");
  ui.pager.innerHTML = `
    <button class="btn ghost pager-btn" type="button" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Prev</button>
    <span class="pager-status">${page} / ${totalPages}</span>
    <button class="btn ghost pager-btn" type="button" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>Next</button>
  `;
}

async function loadPosts(page = state.pagination.page) {
  state.pagination.page = Number.isInteger(page) && page > 0 ? page : 1;

  const data = await request(
    `/api/threads?limit=${state.pagination.limit}&page=${state.pagination.page}`
  );

  state.posts = Array.isArray(data.posts) ? data.posts : [];
  state.pagination.total = Number(data.total || 0);
  state.pagination.totalPages = Math.max(1, Number(data.totalPages || 1));

  if (state.pagination.page > state.pagination.totalPages) {
    state.pagination.page = state.pagination.totalPages;
    return loadPosts(state.pagination.page);
  }

  syncPageQuery();
  renderPosts();
  renderPager();
}

function bindEvents() {
  ui.pager.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest(".pager-btn");
    if (!button) return;

    const page = Number(button.getAttribute("data-page"));
    if (!Number.isInteger(page) || page < 1) return;

    loadPosts(page).catch((error) => {
      ui.list.innerHTML = `<article class="card empty-card">${escapeHtml(error.message)}</article>`;
    });
  });
}

(async function init() {
  bindEvents();
  state.pagination.page = parsePageParam();

  try {
    await loadPosts(state.pagination.page);
  } catch (error) {
    ui.list.innerHTML = `<article class="card empty-card">${escapeHtml(error.message)}</article>`;
  }
})();
