const state = {
  threadId: null,
  currentPage: 1,
  thread: null,
  posts: [],
  mutedPosterIds: new Set(),
  config: {
    turnstileSiteKey: null,
    uploadsEnabled: false,
    maxUploadBytes: 80 * 1024 * 1024
  },
  turnstile: {
    scriptLoaded: false,
    widgets: {},
    tokens: {}
  },
  previewUrl: null,
  replyCountMap: {}
};

const DELETE_TOKEN_STORAGE_KEY = "postDeleteTokensV1";
const THREAD_MUTE_STORAGE_KEY = "threadPosterMutesV1";
const POSTS_PER_PAGE = 100;
const DEFAULT_THREAD_THUMB_URL = "/default-thread-thumb.webp";
const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|bmp|avif)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|mkv)$/i;

const ui = {
  replyForm: document.querySelector("#replyForm"),
  detailEl: document.querySelector("#threadDetail"),
  latestThreadsList: document.querySelector("#latestThreadsList"),
  imageModal: document.querySelector("#imageModal"),
  imageModalImg: document.querySelector("#imageModalImg"),
  closeImageModalBtn: document.querySelector("#closeImageModalBtn"),
  videoModal: document.querySelector("#videoModal"),
  videoModalPlayer: document.querySelector("#videoModalPlayer"),
  closeVideoModalBtn: document.querySelector("#closeVideoModalBtn"),
  quoteModal: document.querySelector("#quoteModal"),
  quoteModalTitle: document.querySelector("#quoteModalTitle"),
  quoteModalContent: document.querySelector("#quoteModalContent"),
  closeQuoteModalBtn: document.querySelector("#closeQuoteModalBtn"),
  scrollToBottomBtn: document.querySelector("#scrollToBottomBtn")
};

function parseThreadId() {
  const params = new URLSearchParams(window.location.search);
  const qid = Number(params.get("id"));
  if (Number.isInteger(qid) && qid > 0) return qid;

  const path = window.location.pathname.replace(/\/+$/, "");
  const match = path.match(/\/thread\/(\d+)$/);
  if (match) return Number(match[1]);

  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  if (/^\d+$/.test(last)) return Number(last);

  return null;
}

function parsePageParam() {
  const params = new URLSearchParams(window.location.search);
  const p = Number(params.get("p"));
  if (Number.isInteger(p) && p > 0) return p;
  return 1;
}

function totalPages() {
  const total = Math.ceil((state.posts.length || 0) / POSTS_PER_PAGE);
  return total > 0 ? total : 1;
}

function clampPage(page) {
  const n = Number(page);
  if (!Number.isInteger(n) || n < 1) return 1;
  const max = totalPages();
  if (n > max) return max;
  return n;
}

function syncPageQuery() {
  const url = new URL(window.location.href);
  if (state.currentPage > 1) {
    url.searchParams.set("p", String(state.currentPage));
  } else {
    url.searchParams.delete("p");
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function formatDate(input) {
  if (!input) return "-";
  const d = new Date(`${input}Z`);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString();
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str = "") {
  return escapeHtml(str);
}

function readDeleteTokenMap() {
  try {
    const raw = localStorage.getItem(DELETE_TOKEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeDeleteTokenMap(map) {
  localStorage.setItem(DELETE_TOKEN_STORAGE_KEY, JSON.stringify(map));
}

function getDeleteToken(postId) {
  const map = readDeleteTokenMap();
  const token = map[String(postId)];
  return typeof token === "string" && token ? token : null;
}

function rememberDeleteToken(postId, token) {
  if (!Number.isInteger(postId) || postId <= 0 || !token) return;
  const map = readDeleteTokenMap();
  map[String(postId)] = token;
  writeDeleteTokenMap(map);
}

function forgetDeleteToken(postId) {
  const map = readDeleteTokenMap();
  delete map[String(postId)];
  writeDeleteTokenMap(map);
}

function normalizePosterId(value) {
  const raw = String(value || "--------").trim();
  return raw || "--------";
}

function readThreadMuteMap() {
  try {
    const raw = localStorage.getItem(THREAD_MUTE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeThreadMuteMap(map) {
  localStorage.setItem(THREAD_MUTE_STORAGE_KEY, JSON.stringify(map));
}

function readMutedPosterSet(threadId) {
  if (!Number.isInteger(threadId) || threadId <= 0) return new Set();
  const map = readThreadMuteMap();
  const rawList = map[String(threadId)];
  if (!Array.isArray(rawList)) return new Set();
  const list = rawList
    .filter((value) => typeof value === "string")
    .map((value) => normalizePosterId(value));
  return new Set(list);
}

function saveMutedPosterSet(threadId, posterSet) {
  if (!Number.isInteger(threadId) || threadId <= 0) return;
  const map = readThreadMuteMap();
  const key = String(threadId);
  const values = Array.from(posterSet);
  if (values.length > 0) {
    map[key] = values;
  } else {
    delete map[key];
  }
  writeThreadMuteMap(map);
}

function isPosterMuted(posterId) {
  const normalized = normalizePosterId(posterId);
  return state.mutedPosterIds.has(normalized);
}

function setPosterMute(posterId, muted) {
  const normalized = normalizePosterId(posterId);
  if (!Number.isInteger(state.threadId) || state.threadId <= 0) return;
  if (muted) {
    state.mutedPosterIds.add(normalized);
  } else {
    state.mutedPosterIds.delete(normalized);
  }
  saveMutedPosterSet(state.threadId, state.mutedPosterIds);
}

function isPostMuted(post) {
  return isPosterMuted(post?.posterId);
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
    const message = typeof body === "object" && body && body.error ? body.error : `Request failed (${res.status})`;
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

  return "link";
}

function detectSelectedFileKind(file) {
  if (!file) return "none";
  const mime = String(file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";

  const name = String(file.name || "");
  if (IMAGE_EXT_RE.test(name)) return "image";
  if (VIDEO_EXT_RE.test(name)) return "video";
  return "unknown";
}

function extractReplyIds(text = "") {
  const result = new Set();
  const re = />>(\d{1,9})/g;
  let match = re.exec(text);
  while (match) {
    const id = Number(match[1]);
    if (Number.isInteger(id) && id > 0) result.add(id);
    match = re.exec(text);
  }
  return result;
}

function buildReplyCountMap(posts = []) {
  const validNos = new Set(posts.map((post) => Number(post.localNo)));
  const map = {};
  for (const post of posts) {
    const refs = extractReplyIds(post.body || "");
    for (const ref of refs) {
      if (!validNos.has(ref)) continue;
      const key = String(ref);
      map[key] = (map[key] || 0) + 1;
    }
  }
  return map;
}

function renderPostBody(body = "") {
  const escaped = escapeHtml(body);
  const withUrls = escaped.replace(
    /https?:\/\/[^\s<]+/g,
    (url) =>
      `<a class="post-link" href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`
  );
  const linked = withUrls.replace(
    /&gt;&gt;(\d{1,9})/g,
    (_, id) => `<button class="quote-link" data-quote-id="${id}" type="button">&gt;&gt;${id}</button>`
  );
  return linked.replace(/\n/g, "<br />");
}

function renderMedia(post) {
  if (!post.mediaUrl) return "";

  const kind = guessMediaKind(post.mediaUrl, post.mediaMime);
  const safeUrl = escapeAttr(post.mediaUrl);

  if (kind === "image") {
    return `<div class="media-wrap"><button class="post-image-thumb" data-image-src="${safeUrl}" type="button"><img src="${safeUrl}" loading="lazy" alt="メディア" /></button></div>`;
  }
  if (kind === "video") {
    return `
      <div class="media-wrap">
        <button class="post-video-thumb" data-video-src="${safeUrl}" type="button" aria-label="動画を再生">
          <video preload="metadata" muted playsinline src="${safeUrl}"></video>
          <span class="post-video-play" aria-hidden="true">▶</span>
        </button>
      </div>
    `;
  }

  return `<a href="${safeUrl}" target="_blank" rel="noopener">${escapeHtml(post.mediaUrl)}</a>`;
}

function postMetaHtml(post) {
  const author = post.authorName || "名無しちゃん";
  const posterId = normalizePosterId(post.posterId);
  const localNo = Number(post.localNo || 0);
  return `
    <div class="post-meta">
      <span class="post-meta-left">${localNo} ${escapeHtml(author)}</span>
      <span class="post-meta-right">
        <span class="post-date">${formatDate(post.createdAt)}</span>
        <button class="poster-id-link" data-poster-id="${escapeAttr(posterId)}" type="button">ID:${escapeHtml(posterId)}</button>
      </span>
    </div>
  `;
}

function mutedPostHtml(post, { preview = false } = {}) {
  const posterId = normalizePosterId(post.posterId);
  const cardClass = preview ? "post quote-preview-post is-muted" : "post is-muted";
  return `
    <article class="${cardClass}" data-post-id="${post.id}">
      ${postMetaHtml(post)}
      <p class="post-muted-note">ミュートされたレスです。</p>
      <div class="post-actions">
        <button class="btn ghost mini unmute-poster-btn" data-poster-id="${escapeAttr(posterId)}" type="button">解除</button>
      </div>
    </article>
  `;
}

function postHtml(post) {
  if (isPostMuted(post)) return mutedPostHtml(post);

  const canDelete = Boolean(getDeleteToken(post.id));
  const localNo = Number(post.localNo || 0);
  const posterId = normalizePosterId(post.posterId);
  const replyCount = state.replyCountMap[String(localNo)] || 0;

  return `
    <article class="post" data-post-id="${post.id}">
      ${postMetaHtml(post)}
      <p class="post-body">${renderPostBody(post.body)}</p>
      ${renderMedia(post)}
      <div class="post-actions">
        <button class="btn ghost mini reply-post-btn" data-reply-no="${localNo}" type="button">返信</button>
        <button class="btn danger mini report-post-btn" data-post-id="${post.id}" type="button">通報</button>
        <button class="btn ghost mini mute-poster-btn" data-poster-id="${escapeAttr(posterId)}" type="button">ミュート</button>
        ${replyCount > 0 ? `<button class="reply-count-chip reply-count-btn" data-reply-target-no="${localNo}" title="この投稿への返信一覧" type="button">↩ ${replyCount}</button>` : ""}
        ${canDelete ? `<button class="btn mini delete-post-btn" data-post-id="${post.id}" type="button">削除</button>` : ""}
      </div>
    </article>
  `;
}

function previewPostHtml(post) {
  if (isPostMuted(post)) return mutedPostHtml(post, { preview: true });

  return `
    <article class="post quote-preview-post">
      ${postMetaHtml(post)}
      <p class="post-body">${renderPostBody(post.body)}</p>
      ${renderMedia(post)}
    </article>
  `;
}

function quotePreviewHtml(postNo) {
  const post = state.posts.find((item) => Number(item.localNo) === postNo);
  if (!post) {
    return `<p class="empty">>>${postNo} の投稿は見つかりません。</p>`;
  }
  return previewPostHtml(post);
}

function repliesPreviewHtml(targetNo) {
  const replies = [];
  for (const post of state.posts) {
    const refs = extractReplyIds(post.body || "");
    if (refs.has(targetNo)) replies.push(post);
  }

  if (!replies.length) {
    return `<p class="empty">>>${targetNo} への返信はまだありません。</p>`;
  }

  return replies.map(previewPostHtml).join("");
}

function postsByPosterId(posterId) {
  const key = String(posterId || "");
  return state.posts.filter((post) => String(post.posterId || "--------") === key);
}

function renderThread() {
  const t = state.thread;
  if (!t) {
    ui.detailEl.innerHTML = `<p class="empty">指定されたスレッドは存在しません。</p>`;
    ui.replyForm.classList.add("hidden");
    return;
  }

  document.title = `${t.title} | AIちゃんねる`;

  if (t.isLocked || state.posts.length >= 1000) {
    ui.replyForm.classList.add("hidden");
  } else {
    ui.replyForm.classList.remove("hidden");
    ui.replyForm.elements.threadId.value = String(t.id);
  }

  state.currentPage = clampPage(state.currentPage);
  const maxPages = totalPages();
  const start = (state.currentPage - 1) * POSTS_PER_PAGE;
  const pagePosts = state.posts.slice(start, start + POSTS_PER_PAGE);
  const posts = pagePosts.map(postHtml).join("");
  const hasPager = maxPages > 1;
  const pager = hasPager
    ? `
      <nav class="pagination-nav" aria-label="レスページ移動">
        <button
          class="btn ghost mini page-nav-btn"
          type="button"
          data-page="${state.currentPage - 1}"
          ${state.currentPage <= 1 ? "disabled" : ""}
        >
          ←
        </button>
        <span class="pagination-status">${state.currentPage} / ${maxPages}</span>
        <button
          class="btn ghost mini page-nav-btn"
          type="button"
          data-page="${state.currentPage + 1}"
          ${state.currentPage >= maxPages ? "disabled" : ""}
        >
          →
        </button>
      </nav>
    `
    : "";

  ui.detailEl.innerHTML = `
    <h3 class="thread-title">${escapeHtml(t.title)}</h3>
    <section class="post-list">${posts || '<p class="empty">投稿はまだありません</p>'}</section>
    ${pager}
  `;
}

function renderLatestThreads(threads) {
  if (!ui.latestThreadsList) return;
  if (!Array.isArray(threads) || !threads.length) {
    ui.latestThreadsList.innerHTML = '<li class="muted">スレッドがまだありません。</li>';
    return;
  }

  function resolveThreadThumbUrl(thread) {
    const raw = typeof thread?.thumbnailUrl === "string" ? thread.thumbnailUrl.trim() : "";
    const kind = guessMediaKind(raw, thread?.thumbnailMime || "");
    if (raw && kind === "image") return raw;
    return DEFAULT_THREAD_THUMB_URL;
  }

  ui.latestThreadsList.innerHTML = threads
    .slice(0, 10)
    .map((thread) => {
      const id = Number(thread.id);
      const title = escapeHtml(thread.title || "無題");
      const updated = escapeHtml(formatDate(thread.updatedAt));
      const thumbUrl = escapeAttr(resolveThreadThumbUrl(thread));
      return `
        <li>
          <a class="latest-thread-item" href="/thread/${id}">
            <span class="latest-thread-thumb"><img src="${thumbUrl}" alt="thumb" loading="lazy" /></span>
            <span class="latest-thread-main">
              <span class="latest-thread-link">${title}</span>
              <span class="latest-thread-updated">${updated}</span>
            </span>
          </a>
        </li>
      `;
    })
    .join("");
}

async function loadLatestThreads() {
  const data = await request("/api/threads?limit=10&nsfw=include");
  const threads = data && Array.isArray(data.threads) ? data.threads : [];
  renderLatestThreads(threads);
}

function getReplyMetaEl() {
  return document.querySelector('[data-file-meta="reply"]');
}

function getReplyPreviewEl() {
  return document.querySelector('[data-file-preview="reply"]');
}

function clearReplyFileSelection() {
  const mediaInput = ui.replyForm && ui.replyForm.elements ? ui.replyForm.elements.mediaFile : null;
  if (mediaInput) mediaInput.value = "";
  ui.replyForm.elements.mediaUrl.value = "";
  ui.replyForm.elements.mediaMime.value = "";
  ui.replyForm.elements.mediaKey.value = "";
  clearReplyPreview();
}

function clearReplyPreview() {
  const metaEl = getReplyMetaEl();
  const previewEl = getReplyPreviewEl();

  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }

  if (metaEl) metaEl.textContent = "ファイル未選択";
  if (previewEl) {
    previewEl.innerHTML = "";
    previewEl.classList.add("hidden");
  }
}

function updateReplyPreview() {
  const mediaInput = ui.replyForm && ui.replyForm.elements ? ui.replyForm.elements.mediaFile : null;
  const file = mediaInput && mediaInput.files ? mediaInput.files[0] : null;
  const metaEl = getReplyMetaEl();
  const previewEl = getReplyPreviewEl();
  if (!metaEl || !previewEl) return;

  if (!file) {
    clearReplyPreview();
    return;
  }

  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }

  metaEl.textContent = `${file.name} (${formatBytes(file.size)})`;
  const kind = detectSelectedFileKind(file);

  if (kind === "image") {
    const objectUrl = URL.createObjectURL(file);
    state.previewUrl = objectUrl;
    previewEl.innerHTML = `
      <div class="file-preview-media">
        <button class="file-preview-remove" type="button" aria-label="画像を取り消し">×</button>
        <img src="${escapeAttr(objectUrl)}" alt="preview" />
      </div>
    `;
    previewEl.classList.remove("hidden");
    return;
  }

  if (kind === "video") {
    previewEl.innerHTML = `<p class="file-preview-note">動画を選択: ${escapeHtml(file.name)}</p>`;
    previewEl.classList.remove("hidden");
    return;
  }

  clearReplyFileSelection();
  alert("画像または動画ファイルのみ選択できます。");
  previewEl.innerHTML = "";
  previewEl.classList.add("hidden");
}

function injectReplyAnchor(postNo) {
  if (!ui.replyForm || ui.replyForm.classList.contains("hidden")) return;
  const area = ui.replyForm.elements.body;
  const marker = `>>${postNo}`;
  const current = String(area.value || "");

  if (!current.includes(marker)) {
    area.value = `${marker}\n${current}`;
  }

  area.focus();
  const len = area.value.length;
  area.setSelectionRange(len, len);
}

function openImageModal(src) {
  if (!src || !ui.imageModal || !ui.imageModalImg) return;
  ui.imageModalImg.src = src;
  ui.imageModal.classList.remove("hidden");
}

function closeImageModal() {
  if (!ui.imageModal || !ui.imageModalImg) return;
  ui.imageModal.classList.add("hidden");
  ui.imageModalImg.src = "";
}

function openVideoModal(src) {
  if (!src || !ui.videoModal || !ui.videoModalPlayer) return;
  ui.videoModalPlayer.src = src;
  ui.videoModal.classList.remove("hidden");
  const playPromise = ui.videoModalPlayer.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function closeVideoModal() {
  if (!ui.videoModal || !ui.videoModalPlayer) return;
  ui.videoModal.classList.add("hidden");
  ui.videoModalPlayer.pause();
  ui.videoModalPlayer.removeAttribute("src");
  ui.videoModalPlayer.load();
}

function openQuoteModal(postNo) {
  if (!Number.isInteger(postNo) || postNo <= 0 || !ui.quoteModal || !ui.quoteModalContent) return;
  if (ui.quoteModalTitle) ui.quoteModalTitle.textContent = `参照レス >>${postNo}`;
  ui.quoteModalContent.innerHTML = quotePreviewHtml(postNo);
  ui.quoteModal.classList.remove("hidden");
}

function openRepliesModal(targetNo) {
  if (!Number.isInteger(targetNo) || targetNo <= 0 || !ui.quoteModal || !ui.quoteModalContent) return;
  const count = state.replyCountMap[String(targetNo)] || 0;
  if (ui.quoteModalTitle) ui.quoteModalTitle.textContent = `>>${targetNo} への返信 (${count})`;
  ui.quoteModalContent.innerHTML = repliesPreviewHtml(targetNo);
  ui.quoteModal.classList.remove("hidden");
}

function openPosterIdModal(posterId) {
  const key = String(posterId || "").trim();
  if (!key || !ui.quoteModal || !ui.quoteModalContent) return;
  const matches = postsByPosterId(key);
  if (ui.quoteModalTitle) ui.quoteModalTitle.textContent = `ID:${key} の投稿 (${matches.length})`;
  ui.quoteModalContent.innerHTML = matches.length
    ? matches.map(previewPostHtml).join("")
    : `<p class="empty">ID:${escapeHtml(key)} の投稿は見つかりません。</p>`;
  ui.quoteModal.classList.remove("hidden");
}

function closeQuoteModal() {
  if (!ui.quoteModal || !ui.quoteModalContent) return;
  ui.quoteModal.classList.add("hidden");
  ui.quoteModalContent.innerHTML = "";
}

function scrollToBottomPost() {
  const posts = ui.detailEl?.querySelectorAll(".post-list .post");
  if (posts && posts.length > 0) {
    const last = posts[posts.length - 1];
    if (last instanceof HTMLElement) {
      last.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }
  }
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function deleteOwnPost(postId) {
  const deleteToken = getDeleteToken(postId);
  if (!deleteToken) {
    alert("この投稿の削除トークンが見つかりません。\n同じブラウザから投稿した場合のみ削除できます。");
    return;
  }

  const ok = window.confirm(`投稿 #${postId} を削除します。よろしいですか？`);
  if (!ok) return;

  try {
    await request(`/api/posts/${postId}`, {
      method: "DELETE",
      body: JSON.stringify({ deleteToken })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    const tokenMismatch =
      message.includes("Invalid delete token") ||
      message.includes("cannot be deleted by user token") ||
      message.includes("Post not found");
    if (tokenMismatch) {
      forgetDeleteToken(postId);
      await loadThread();
      throw new Error("この投稿の削除権限がないため、削除ボタンを更新しました。");
    }
    throw error;
  }

  forgetDeleteToken(postId);
  await loadThread();
}

async function submitReport(postId) {
  const reportToken = state.turnstile.tokens.reply || undefined;
  return request("/api/reports", {
    method: "POST",
    body: JSON.stringify({
      threadId: state.threadId,
      postId,
      reason: "other",
      details: "quick-report",
      turnstileToken: reportToken
    })
  });
}

async function loadConfig() {
  const data = await request("/api/config");
  state.config = {
    ...state.config,
    ...data
  };
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
    script.onerror = () => reject(new Error("Turnstileスクリプトの読み込みに失敗しました。"));
    document.head.appendChild(script);
  });

  state.turnstile.scriptLoaded = true;
}

async function setupTurnstile() {
  const siteKey = state.config.turnstileSiteKey;
  const slots = document.querySelectorAll('.turnstile-slot[data-turnstile="reply"]');

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
  if (!token) throw new Error("Turnstile認証が必要です。");
  return token;
}

function resetTurnstile(name) {
  const widgetId = state.turnstile.widgets[name];
  if (widgetId === undefined || !window.turnstile) return;
  window.turnstile.reset(widgetId);
  state.turnstile.tokens[name] = null;
}

async function loadThread(options = {}) {
  const data = await request(`/api/threads/${state.threadId}?nsfw=include&postLimit=1000`);
  state.thread = data.thread || null;
  const rawPosts = Array.isArray(data.posts) ? data.posts : [];
  state.posts = rawPosts.map((post, index) => ({
    ...post,
    localNo: index + 1
  }));
  state.mutedPosterIds = readMutedPosterSet(state.threadId);
  state.replyCountMap = buildReplyCountMap(state.posts);
  if (options.preferLastPage) {
    state.currentPage = totalPages();
  } else {
    state.currentPage = clampPage(state.currentPage);
  }
  syncPageQuery();
  renderThread();
}

async function uploadReplyFileIfSelected() {
  const mediaInput = ui.replyForm && ui.replyForm.elements ? ui.replyForm.elements.mediaFile : null;
  const file = mediaInput && mediaInput.files ? mediaInput.files[0] : null;
  if (!file) return null;

  const kind = detectSelectedFileKind(file);
  if (kind !== "image" && kind !== "video") {
    throw new Error("画像または動画ファイルのみ投稿できます。");
  }

  if (file.size > state.config.maxUploadBytes) {
    throw new Error(`ファイルサイズ上限は ${formatBytes(state.config.maxUploadBytes)} です。`);
  }

  if (!state.config.uploadsEnabled) {
    throw new Error("ファイルアップロードが有効化されていません。");
  }

  const formData = new FormData();
  formData.set("file", file);

  const result = await request("/api/media/upload", {
    method: "POST",
    body: formData
  });

  ui.replyForm.elements.mediaKey.value = result.mediaKey || "";
  ui.replyForm.elements.mediaUrl.value = result.mediaUrl || "";
  ui.replyForm.elements.mediaMime.value = result.mimeType || "";
  return result;
}

function resetReplyComposer() {
  ui.replyForm.reset();
  ui.replyForm.elements.threadId.value = String(state.threadId);
  ui.replyForm.elements.mediaUrl.value = "";
  ui.replyForm.elements.mediaMime.value = "";
  ui.replyForm.elements.mediaKey.value = "";
  clearReplyPreview();
}

async function onReply(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const btn = form.querySelector("button[type='submit']");

  try {
    btn.disabled = true;

    const authorField = form.elements.authorName;
    const authorName = String((authorField && authorField.value) || "").trim();
    const body = (form.elements.body.value || "").trim();

    await uploadReplyFileIfSelected();
    const mediaUrl = form.elements.mediaUrl.value || "";
    if (!body && !mediaUrl) throw new Error("本文か画像・動画ファイルのどちらかは必須です。");

    const payload = {
      threadId: Number(form.elements.threadId.value),
      body: body || undefined,
      authorName: authorName || undefined,
      nsfw: false,
      mediaKey: form.elements.mediaKey.value || undefined,
      mediaUrl: mediaUrl || undefined,
      mediaMime: form.elements.mediaMime.value || undefined,
      turnstileToken: readTurnstileToken("reply")
    };

    const data = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const createdPost = data && data.post ? data.post : null;
    const postId = Number(createdPost && createdPost.id);
    const deleteToken = data && typeof data.deleteToken === "string" ? data.deleteToken : "";
    if (Number.isInteger(postId) && postId > 0 && deleteToken) {
      rememberDeleteToken(postId, deleteToken);
    }

    resetReplyComposer();
    resetTurnstile("reply");
    await loadThread({ preferLastPage: true });
    await loadLatestThreads();
  } catch (error) {
    alert(error.message);
  } finally {
    btn.disabled = false;
  }
}

function bindEvents() {
  ui.replyForm.addEventListener("submit", onReply);
  const mediaInput = ui.replyForm.elements.mediaFile;
  if (mediaInput) mediaInput.addEventListener("change", updateReplyPreview);

  const previewEl = getReplyPreviewEl();
  if (previewEl) {
    previewEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const removeBtn = target.closest(".file-preview-remove");
      if (!removeBtn) return;
      clearReplyFileSelection();
    });
  }

  ui.detailEl.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const quoteBtn = target.closest(".quote-link");
    if (quoteBtn) {
      const postId = Number(quoteBtn.getAttribute("data-quote-id"));
      if (Number.isInteger(postId) && postId > 0) openQuoteModal(postId);
      return;
    }

    const imageBtn = target.closest(".post-image-thumb");
    if (imageBtn) {
      const src = imageBtn.getAttribute("data-image-src") || "";
      if (src) openImageModal(src);
      return;
    }

    const videoBtn = target.closest(".post-video-thumb");
    if (videoBtn) {
      const src = videoBtn.getAttribute("data-video-src") || "";
      if (src) openVideoModal(src);
      return;
    }

    const replyBtn = target.closest(".reply-post-btn");
    if (replyBtn) {
      const postNo = Number(replyBtn.getAttribute("data-reply-no"));
      if (Number.isInteger(postNo) && postNo > 0) injectReplyAnchor(postNo);
      return;
    }

    const replyCountBtn = target.closest(".reply-count-btn");
    if (replyCountBtn) {
      const targetNo = Number(replyCountBtn.getAttribute("data-reply-target-no"));
      if (Number.isInteger(targetNo) && targetNo > 0) openRepliesModal(targetNo);
      return;
    }

    const posterIdBtn = target.closest(".poster-id-link");
    if (posterIdBtn) {
      const posterId = posterIdBtn.getAttribute("data-poster-id") || "";
      openPosterIdModal(posterId);
      return;
    }

    const pageNavBtn = target.closest(".page-nav-btn");
    if (pageNavBtn) {
      const page = Number(pageNavBtn.getAttribute("data-page"));
      if (!Number.isInteger(page) || page < 1) return;
      state.currentPage = clampPage(page);
      syncPageQuery();
      renderThread();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const reportBtn = target.closest(".report-post-btn");
    if (reportBtn) {
      const postId = Number(reportBtn.getAttribute("data-post-id"));
      if (!Number.isInteger(postId) || postId <= 0) return;
      const ok = window.confirm(`投稿 #${postId} を通報しますか？`);
      if (!ok) return;
      try {
        const result = await submitReport(postId);
        const count = Number(result?.moderation?.uniqueReporterCount || 0);
        const autoDeleted = Boolean(result?.moderation?.autoDeleted);
        if (autoDeleted) {
          alert("通報を送信しました。24時間以内の通報10件に達したため、このレスは削除されました。");
          await loadThread();
        } else {
          alert(`通報を送信しました。（24時間ユニークID通報: ${count}/10）`);
        }
      } catch (error) {
        alert(error.message);
      }
      return;
    }

    const muteBtn = target.closest(".mute-poster-btn");
    if (muteBtn) {
      const posterId = muteBtn.getAttribute("data-poster-id") || "";
      setPosterMute(posterId, true);
      renderThread();
      return;
    }

    const unmuteBtn = target.closest(".unmute-poster-btn");
    if (unmuteBtn) {
      const posterId = unmuteBtn.getAttribute("data-poster-id") || "";
      setPosterMute(posterId, false);
      renderThread();
      return;
    }

    const deleteBtn = target.closest(".delete-post-btn");
    if (deleteBtn) {
      const postId = Number(deleteBtn.getAttribute("data-post-id"));
      if (!Number.isInteger(postId) || postId <= 0) return;
      try {
        await deleteOwnPost(postId);
      } catch (error) {
        alert(error.message);
      }
    }
  });

  if (ui.closeImageModalBtn) ui.closeImageModalBtn.addEventListener("click", closeImageModal);
  if (ui.imageModal) {
    ui.imageModal.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches("[data-close-image-modal]")) closeImageModal();
    });
  }
  if (ui.closeVideoModalBtn) ui.closeVideoModalBtn.addEventListener("click", closeVideoModal);
  if (ui.videoModal) {
    ui.videoModal.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches("[data-close-video-modal]")) closeVideoModal();
    });
  }
  if (ui.closeQuoteModalBtn) ui.closeQuoteModalBtn.addEventListener("click", closeQuoteModal);
  if (ui.scrollToBottomBtn) {
    ui.scrollToBottomBtn.addEventListener("click", scrollToBottomPost);
  }
  if (ui.quoteModal) {
    ui.quoteModal.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches("[data-close-quote-modal]")) closeQuoteModal();
    });
  }
  if (ui.quoteModalContent) {
    ui.quoteModalContent.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const muteBtn = target.closest(".mute-poster-btn");
      if (muteBtn) {
        const posterId = muteBtn.getAttribute("data-poster-id") || "";
        setPosterMute(posterId, true);
        closeQuoteModal();
        renderThread();
        return;
      }

      const unmuteBtn = target.closest(".unmute-poster-btn");
      if (unmuteBtn) {
        const posterId = unmuteBtn.getAttribute("data-poster-id") || "";
        setPosterMute(posterId, false);
        closeQuoteModal();
        renderThread();
        return;
      }

      const quoteBtn = target.closest(".quote-link");
      if (quoteBtn) {
        const postId = Number(quoteBtn.getAttribute("data-quote-id"));
        if (Number.isInteger(postId) && postId > 0) openQuoteModal(postId);
        return;
      }

      const imageBtn = target.closest(".post-image-thumb");
      if (imageBtn) {
        const src = imageBtn.getAttribute("data-image-src") || "";
        if (src) openImageModal(src);
        return;
      }

      const videoBtn = target.closest(".post-video-thumb");
      if (videoBtn) {
        const src = videoBtn.getAttribute("data-video-src") || "";
        if (src) openVideoModal(src);
        return;
      }

      const posterIdBtn = target.closest(".poster-id-link");
      if (posterIdBtn) {
        const posterId = posterIdBtn.getAttribute("data-poster-id") || "";
        openPosterIdModal(posterId);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeImageModal();
      closeVideoModal();
      closeQuoteModal();
    }
  });
}

window.addEventListener("beforeunload", () => {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
});

(async function init() {
  state.threadId = parseThreadId();
  state.currentPage = parsePageParam();
  if (!state.threadId) {
    ui.detailEl.innerHTML = `<p class="empty">URLを確認してください。</p>`;
    ui.replyForm.classList.add("hidden");
    return;
  }

  bindEvents();

  try {
    await loadConfig();
    await setupTurnstile();
    await loadThread();
    try {
      await loadLatestThreads();
    } catch {
      renderLatestThreads([]);
    }
  } catch (error) {
    ui.detailEl.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
    ui.replyForm.classList.add("hidden");
  }
})();
