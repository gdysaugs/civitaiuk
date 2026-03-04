const state = {
  config: {
    turnstileSiteKey: null
  },
  turnstile: {
    loaded: false,
    widgetId: null,
    token: null
  }
};

const ui = {
  form: document.querySelector("#contactReportForm"),
  submitBtn: document.querySelector("#contactReportSubmitBtn"),
  message: document.querySelector("#contactReportMessage"),
  turnstileSlot: document.querySelector("#reportTurnstileSlot")
};

function setMessage(text, ok) {
  if (!ui.message) return;
  ui.message.textContent = text;
  ui.message.classList.remove("hidden", "ok", "error");
  ui.message.classList.add(ok ? "ok" : "error");
}

function clearMessage() {
  if (!ui.message) return;
  ui.message.textContent = "";
  ui.message.classList.add("hidden");
  ui.message.classList.remove("ok", "error");
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

async function loadConfig() {
  const data = await request("/api/config");
  state.config = {
    ...state.config,
    ...data
  };
}

async function loadTurnstileScript() {
  if (state.turnstile.loaded || window.turnstile) {
    state.turnstile.loaded = true;
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

  state.turnstile.loaded = true;
}

async function setupTurnstile() {
  const siteKey = state.config.turnstileSiteKey;
  if (!siteKey || !ui.turnstileSlot) return;

  await loadTurnstileScript();
  ui.turnstileSlot.classList.remove("hidden");

  if (state.turnstile.widgetId !== null) return;

  state.turnstile.widgetId = window.turnstile.render(ui.turnstileSlot, {
    sitekey: siteKey,
    callback: (token) => {
      state.turnstile.token = token;
    },
    "expired-callback": () => {
      state.turnstile.token = null;
    },
    "error-callback": () => {
      state.turnstile.token = null;
    }
  });
}

function resetTurnstile() {
  if (state.turnstile.widgetId === null || !window.turnstile) return;
  window.turnstile.reset(state.turnstile.widgetId);
  state.turnstile.token = null;
}

async function onSubmit(event) {
  event.preventDefault();
  clearMessage();

  const form = event.currentTarget;
  const title = String(form.elements.title.value || "").trim();
  const content = String(form.elements.content.value || "").trim();
  if (!title) {
    setMessage("タイトルを入力してください。", false);
    return;
  }
  if (!content) {
    setMessage("内容を入力してください。", false);
    return;
  }

  try {
    ui.submitBtn.disabled = true;
    await request("/api/contact-report", {
      method: "POST",
      body: JSON.stringify({
        title,
        content,
        turnstileToken: state.turnstile.token || undefined
      })
    });

    form.reset();
    resetTurnstile();
    setMessage("通報を送信しました。確認のうえ対応します。", true);
  } catch (error) {
    setMessage(error.message, false);
  } finally {
    ui.submitBtn.disabled = false;
  }
}

(async function init() {
  ui.form.addEventListener("submit", onSubmit);
  try {
    await loadConfig();
    await setupTurnstile();
  } catch (error) {
    setMessage(error.message, false);
  }
})();
