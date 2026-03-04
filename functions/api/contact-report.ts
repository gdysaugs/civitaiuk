import { verifyTurnstileWhen } from "../_security";
import { buildPosterId, cleanLongText, cleanText, json, readJson } from "../_utils";

type Env = {
  APP_NAME?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_REQUIRED?: string;
  REPORT_CONTACT_TO?: string;
  REPORT_CONTACT_FROM?: string;
  REPORT_CONTACT_PROVIDER?: string;
  RESEND_API_KEY?: string;
};

type ContactReportPayload = {
  title?: string;
  content?: string;
  turnstileToken?: string;
};

const DEFAULT_REPORT_TO = "mane795134@gmail.com";
const DEFAULT_REPORT_FROM = "noreply@civitai.uk";
const DEFAULT_PROVIDER = "mailchannels";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendViaMailChannels(input: {
  to: string;
  from: string;
  appName: string;
  subject: string;
  textBody: string;
}) {
  const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: input.to }]
        }
      ],
      from: {
        email: input.from,
        name: input.appName
      },
      subject: input.subject,
      content: [
        {
          type: "text/plain",
          value: input.textBody
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`MailChannels failed (${response.status}): ${detail.slice(0, 240)}`);
  }
}

async function sendViaResend(
  apiKey: string,
  input: {
    to: string;
    from: string;
    subject: string;
    textBody: string;
  }
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.textBody
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend failed (${response.status}): ${detail.slice(0, 240)}`);
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const payload = await readJson<ContactReportPayload>(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);

  const title = cleanText(payload.title, 120);
  const content = cleanLongText(payload.content, 4000);
  if (!title || title.length < 2) return json({ error: "タイトルを入力してください。" }, 400);
  if (!content || content.length < 5) return json({ error: "内容を入力してください。" }, 400);

  const turnstile = await verifyTurnstileWhen(request, env, payload.turnstileToken, false);
  if (!turnstile.ok) return json({ error: turnstile.error ?? "Human verification failed." }, 403);

  const reportTo = cleanText(env.REPORT_CONTACT_TO, 254) ?? DEFAULT_REPORT_TO;
  const reportFrom = cleanText(env.REPORT_CONTACT_FROM, 254) ?? DEFAULT_REPORT_FROM;
  if (!isValidEmail(reportTo) || !isValidEmail(reportFrom)) {
    return json({ error: "通報メール送信設定が無効です。" }, 503);
  }

  const appName = cleanText(env.APP_NAME, 80) ?? "AIちゃんねる";
  const provider = (cleanText(env.REPORT_CONTACT_PROVIDER, 20) ?? DEFAULT_PROVIDER).toLowerCase();
  const posterId = await buildPosterId(request);
  const nowIso = new Date().toISOString();
  const origin = new URL(request.url).origin;

  const subject = `[${appName}] 通報フォーム: ${title}`;
  const textBody =
    `サイト: ${appName}\n` +
    `送信元: ${origin}\n` +
    `投稿者ID: ${posterId}\n` +
    `時刻(UTC): ${nowIso}\n` +
    `タイトル: ${title}\n\n` +
    `${content}\n`;

  try {
    if (provider === "resend") {
      const apiKey = env.RESEND_API_KEY?.trim();
      if (!apiKey) return json({ error: "RESEND_API_KEY が未設定です。" }, 503);
      await sendViaResend(apiKey, {
        to: reportTo,
        from: reportFrom,
        subject,
        textBody
      });
    } else {
      await sendViaMailChannels({
        to: reportTo,
        from: reportFrom,
        appName,
        subject,
        textBody
      });
    }
  } catch {
    return json({ error: "メール送信に失敗しました。時間をおいて再度お試しください。" }, 502);
  }

  return json({ ok: true, message: "通報を送信しました。" }, 201);
};
