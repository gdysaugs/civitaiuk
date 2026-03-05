const state = {
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
  previewUrl: null
};

const ui = {
  threadForm: document.querySelector("#threadForm")
};

const DELETE_TOKEN_STORAGE_KEY = "postDeleteTokensV1";
const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|bmp|avif)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|mkv)$/i;

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

function rememberDeleteToken(postId, token) {
  if (!Number.isInteger(postId) || postId <= 0 || !token) return;
  const map = readDeleteTokenMap();
  map[String(postId)] = token;
  writeDeleteTokenMap(map);
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(str = "") {
  return escapeHtml(str);
}

function summarize(text = "", max = 56) {
  const cleaned = String(text).trim().replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}...`;
}

function deriveTitle(body) {
  const candidate = summarize(body, 50) || "無題スレ";
  return candidate.length >= 3 ? candidate : "無題スレ";
}

function resolveThreadTitle(title, body) {
  const manual = summarize(title, 50);
  if (manual && manual.length >= 3) return manual;
  return deriveTitle(body);
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

function getThreadMetaEl() {
  return document.querySelector('[data-file-meta="thread"]');
}

function getThreadPreviewEl() {
  return document.querySelector('[data-file-preview="thread"]');
}

function clearThreadFileSelection() {
  const mediaInput = ui.threadForm?.elements?.mediaFile;
  if (mediaInput) mediaInput.value = "";
  ui.threadForm.elements.mediaUrl.value = "";
  ui.threadForm.elements.mediaMime.value = "";
  ui.threadForm.elements.mediaKey.value = "";
  clearThreadPreview();
}

function clearThreadPreview() {
  const metaEl = getThreadMetaEl();
  const previewEl = getThreadPreviewEl();

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

function updateThreadPreview() {
  const file = ui.threadForm?.elements?.mediaFile?.files?.[0];
  const metaEl = getThreadMetaEl();
  const previewEl = getThreadPreviewEl();
  if (!metaEl || !previewEl) return;

  if (!file) {
    clearThreadPreview();
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

  clearThreadFileSelection();
  alert("画像または動画ファイルのみ選択できます。");
  previewEl.innerHTML = "";
  previewEl.classList.add("hidden");
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
  const slots = document.querySelectorAll('.turnstile-slot[data-turnstile="thread"]');

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

async function uploadThreadFileIfSelected() {
  const file = ui.threadForm?.elements?.mediaFile?.files?.[0];
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

  ui.threadForm.elements.mediaKey.value = result.mediaKey || "";
  ui.threadForm.elements.mediaUrl.value = result.mediaUrl || "";
  ui.threadForm.elements.mediaMime.value = result.mimeType || "";
  return result;
}

async function onCreateThread(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const btn = form.querySelector("button[type='submit']");

  try {
    btn.disabled = true;

    const authorName = (form.elements.authorName?.value || "").trim();
    const titleInput = (form.elements.title?.value || "").trim();
    const body = (form.elements.body.value || "").trim();
    const title = resolveThreadTitle(titleInput, body);

    await uploadThreadFileIfSelected();
    const mediaUrl = form.elements.mediaUrl.value || "";
    if (!body && !mediaUrl) throw new Error("本文か画像・動画ファイルのどちらかは必須です。");

    const payload = {
      body: body || undefined,
      title,
      authorName: authorName || undefined,
      nsfw: false,
      mediaKey: form.elements.mediaKey.value || undefined,
      mediaUrl: mediaUrl || undefined,
      mediaMime: form.elements.mediaMime.value || undefined,
      turnstileToken: readTurnstileToken("thread")
    };

    const data = await request("/api/threads", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const newId = data?.thread?.id;
    const firstPostId = Number(data?.firstPostId);
    const deleteToken = typeof data?.deleteToken === "string" ? data.deleteToken : "";
    if (Number.isInteger(firstPostId) && firstPostId > 0 && deleteToken) {
      rememberDeleteToken(firstPostId, deleteToken);
    }

    if (newId) {
      window.location.href = `/thread/${newId}`;
      return;
    }

    window.location.href = "/";
  } catch (error) {
    alert(error.message);
  } finally {
    btn.disabled = false;
  }
}

function bindEvents() {
  ui.threadForm.addEventListener("submit", onCreateThread);
  ui.threadForm.elements.mediaFile?.addEventListener("change", updateThreadPreview);

  const previewEl = getThreadPreviewEl();
  previewEl?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const removeBtn = target.closest(".file-preview-remove");
    if (!removeBtn) return;
    clearThreadFileSelection();
  });
}

window.addEventListener("beforeunload", () => {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
});

(async function init() {
  bindEvents();

  try {
    await loadConfig();
    await setupTurnstile();
  } catch (error) {
    alert(error.message);
  }
})();
