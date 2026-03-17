const ui = {
  postDetail: document.querySelector("#postDetail")
};

function parsePostId() {
  const params = new URLSearchParams(window.location.search);
  const queryId = Number(params.get("id"));
  if (Number.isInteger(queryId) && queryId > 0) return queryId;

  const path = window.location.pathname.replace(/\/+$/, "");
  const match = path.match(/\/post\/(\d+)$/);
  if (match) return Number(match[1]);

  return null;
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

function renderInline(text = "") {
  const escaped = escapeHtml(text);
  const withCode = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  return withCode.replace(
    /https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`
  );
}

function splitCopyablePrompt(itemText = "") {
  const text = String(itemText || "");
  let separator = "：";
  let index = text.indexOf(separator);

  if (index <= 0) {
    separator = ":";
    index = text.indexOf(separator);
  }

  if (index <= 0) return null;

  const term = text.slice(0, index).trim();
  const meaning = text.slice(index + 1).trim();

  if (!term || !meaning) return null;
  if (/https?:\/\//i.test(term)) return null;

  return { term, meaning, separator };
}

function slugifyHeading(text = "", idMap) {
  const base =
    String(text)
      .trim()
      .toLowerCase()
      .replace(/[`~!@#$%^&*()+=\[\]{}\\|;:'",.<>/?]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section";

  const count = idMap.get(base) || 0;
  idMap.set(base, count + 1);
  if (count === 0) return base;
  return `${base}-${count + 1}`;
}

function renderBody(text = "") {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const headingIdMap = new Map();
  let inList = false;

  const closeList = () => {
    if (!inList) return;
    html.push("</ul>");
    inList = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      closeList();
      html.push("<hr />");
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^)]+)\)$/);
    if (image) {
      closeList();
      const alt = escapeHtml(image[1] || "image");
      const src = escapeHtml(image[2]);
      html.push(
        `<figure class="post-inline-image"><img src="${src}" alt="${alt}" loading="lazy" /></figure>`
      );
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const label = heading[2].trim();
      const id = slugifyHeading(label, headingIdMap);
      html.push(`<h${level} id="${id}">${renderInline(label)}</h${level}>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }

      const itemText = line.slice(2).trim();
      const prompt = splitCopyablePrompt(itemText);

      if (!prompt) {
        html.push(`<li>${renderInline(itemText)}</li>`);
        continue;
      }

      html.push(
        `<li class="copyable-term"><span class="copyable-row"><button class="copy-term-btn" type="button" data-copy="${escapeHtml(prompt.term)}" aria-label="Copy term" title="Copy term"><span aria-hidden="true">⧉</span></button><span class="copyable-line"><code class="prompt-term">${escapeHtml(prompt.term)}</code><span class="prompt-separator">${prompt.separator}</span>${renderInline(prompt.meaning)}</span></span></li>`
      );
      continue;
    }

    closeList();
    html.push(`<p>${renderInline(line)}</p>`);
  }

  closeList();
  return html.join("\n");
}

async function copyText(value = "") {
  const text = String(value || "");
  if (!text) return false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below.
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function bindCopyButtons() {
  ui.postDetail.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest(".copy-term-btn");
    if (!(button instanceof HTMLButtonElement)) return;

    const value = button.dataset.copy || "";
    const copied = await copyText(value);
    const stateClass = copied ? "is-copied" : "is-failed";

    button.classList.remove("is-copied", "is-failed");
    button.classList.add(stateClass);

    const timerId = Number(button.dataset.timerId || "0");
    if (timerId) window.clearTimeout(timerId);

    const nextTimer = window.setTimeout(() => {
      button.classList.remove("is-copied", "is-failed");
      delete button.dataset.timerId;
    }, 1200);

    button.dataset.timerId = String(nextTimer);
  });
}

function renderMedia(post) {
  const mediaUrl = typeof post.mediaUrl === "string" ? post.mediaUrl.trim() : "";
  const thumbnailUrl = typeof post.thumbnailUrl === "string" ? post.thumbnailUrl.trim() : "";
  if (!mediaUrl && !thumbnailUrl) return "";

  // On post detail, show thumbnail under title when available.
  const imageUrl = thumbnailUrl || mediaUrl;
  const mediaKind = guessMediaKind(mediaUrl, post.mediaMime);
  const imageKind = guessMediaKind(imageUrl, post.mediaMime);

  if (imageKind === "image") {
    const safeUrl = escapeHtml(imageUrl);
    return `
      <figure class="post-hero">
        <img src="${safeUrl}" alt="post media" loading="lazy" />
      </figure>
    `;
  }

  if (mediaKind === "video" && mediaUrl) {
    const safeUrl = escapeHtml(mediaUrl);
    return `
      <figure class="post-hero">
        <video src="${safeUrl}" controls playsinline preload="metadata"></video>
      </figure>
    `;
  }

  const fallback = mediaUrl || thumbnailUrl;
  const safeUrl = escapeHtml(fallback);
  return `<p><a href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a></p>`;
}

function resolveCardMedia(post) {
  const thumbnail = typeof post.thumbnailUrl === "string" ? post.thumbnailUrl.trim() : "";
  if (thumbnail) return thumbnail;
  const media = typeof post.mediaUrl === "string" ? post.mediaUrl.trim() : "";
  return media;
}

function renderRecommendedMedia(post) {
  const mediaUrl = resolveCardMedia(post);
  if (!mediaUrl) {
    return '<div class="related-card-placeholder">No media</div>';
  }

  const kind = guessMediaKind(mediaUrl, post.mediaMime);
  const safeUrl = escapeHtml(mediaUrl);

  if (kind === "image") {
    return `<img src="${safeUrl}" loading="lazy" alt="recommended post media" />`;
  }

  if (kind === "video") {
    return `<video src="${safeUrl}" muted playsinline preload="metadata"></video>`;
  }

  return '<div class="related-card-placeholder">Media</div>';
}

function renderRecommendations(posts, currentPostId) {
  const list = Array.isArray(posts)
    ? posts.filter((item) => Number(item?.id) !== Number(currentPostId)).slice(0, 6)
    : [];

  if (!list.length) return "";

  const cards = list
    .map(
      (item) => `
        <a class="related-card" href="/post/${Number(item.id)}">
          <div class="related-card-media">${renderRecommendedMedia(item)}</div>
          <p class="related-card-title">${escapeHtml(item.title || "Untitled")}</p>
        </a>
      `
    )
    .join("");

  return `
    <section class="related-posts">
      <h2>おすすめ記事</h2>
      <div class="related-grid">
        ${cards}
      </div>
    </section>
  `;
}

function renderPost(post, recommendations = []) {
  document.title = `${post.title || "記事"} | AI動画のレシピ`;

  const author = post.authorName ? ` by ${escapeHtml(post.authorName)}` : "";
  const bodyHtml = renderBody(post.body || "");
  const recommendationHtml = renderRecommendations(recommendations, post.id);

  ui.postDetail.innerHTML = `
    <header class="post-header">
      <h1>${escapeHtml(post.title || "Untitled")}</h1>
      <p class="post-meta">${escapeHtml(formatDate(post.createdAt))}${author}</p>
    </header>
    ${renderMedia(post)}
    <section class="post-content">${bodyHtml || "<p>No content.</p>"}</section>
    ${recommendationHtml}
  `;
}

(async function init() {
  bindCopyButtons();

  const postId = parsePostId();
  if (!postId) {
    ui.postDetail.innerHTML = '<p class="empty">Invalid post id.</p>';
    return;
  }

  try {
    const data = await request(`/api/threads/${postId}`);
    if (!data?.post) {
      ui.postDetail.innerHTML = '<p class="empty">Post not found.</p>';
      return;
    }
    renderPost(data.post, data.recommendations);
  } catch (error) {
    ui.postDetail.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
})();
