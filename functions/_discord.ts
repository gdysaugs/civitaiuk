type DiscordEnv = {
  DISCORD_WEBHOOK_URL?: string;
};

type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  timestamp?: string;
  fields?: DiscordEmbedField[];
};

type DiscordMessage = {
  content?: string;
  embeds?: DiscordEmbed[];
  allowed_mentions?: {
    parse?: string[];
  };
};

function readWebhookUrl(env: DiscordEnv): string | null {
  const raw = env.DISCORD_WEBHOOK_URL?.trim();
  if (!raw) return null;
  if (!raw.startsWith("https://discord.com/api/webhooks/")) return null;
  return raw;
}

export async function sendDiscordWebhook(env: DiscordEnv, message: DiscordMessage): Promise<void> {
  const webhookUrl = readWebhookUrl(env);
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        ...message,
        allowed_mentions: message.allowed_mentions ?? { parse: [] }
      })
    });

    if (!response.ok) {
      console.error("discord webhook failed", response.status);
    }
  } catch (error) {
    console.error("discord webhook failed", error);
  }
}

