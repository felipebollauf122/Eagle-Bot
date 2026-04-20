export interface SendMessageParams {
  chatId: number;
  text: string;
  replyMarkup?: InlineKeyboardMarkup;
}

export interface SendPhotoParams {
  chatId: number;
  photo: string; // URL
  caption?: string;
  replyMarkup?: InlineKeyboardMarkup;
}

export interface SendVideoParams {
  chatId: number;
  video: string; // URL or file_id
  caption?: string;
  replyMarkup?: InlineKeyboardMarkup;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  copy_text?: { text: string };
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number };
}

export class TelegramApi {
  private baseUrl: string;

  constructor(private token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  get botToken(): string {
    return this.token;
  }

  async sendMessage(params: SendMessageParams): Promise<TelegramMessage | null> {
    const text = params.text?.trim();
    if (!text) {
      console.warn("[telegram] Skipping sendMessage: empty text");
      return null;
    }
    const body: Record<string, unknown> = {
      chat_id: params.chatId,
      text,
      parse_mode: "HTML",
    };
    if (params.replyMarkup) {
      body.reply_markup = params.replyMarkup;
    }
    const result = await this.request("sendMessage", body);
    return result as TelegramMessage | null;
  }

  async sendPhoto(params: SendPhotoParams): Promise<TelegramMessage | null> {
    if (!params.photo?.trim()) {
      console.warn("[telegram] Skipping sendPhoto: empty photo URL");
      return null;
    }
    const body: Record<string, unknown> = {
      chat_id: params.chatId,
      photo: params.photo,
      parse_mode: "HTML",
    };
    if (params.caption) {
      body.caption = params.caption;
    }
    if (params.replyMarkup) {
      body.reply_markup = params.replyMarkup;
    }
    const result = await this.request("sendPhoto", body);
    return result as TelegramMessage | null;
  }

  async sendVideo(params: SendVideoParams): Promise<TelegramMessage | null> {
    if (!params.video?.trim()) {
      console.warn("[telegram] Skipping sendVideo: empty video URL");
      return null;
    }
    const body: Record<string, unknown> = {
      chat_id: params.chatId,
      video: params.video,
      parse_mode: "HTML",
    };
    if (params.caption) {
      body.caption = params.caption;
    }
    if (params.replyMarkup) {
      body.reply_markup = params.replyMarkup;
    }
    const result = await this.request("sendVideo", body);
    return result as TelegramMessage | null;
  }

  async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
    try {
      await this.request("deleteMessage", {
        chat_id: chatId,
        message_id: messageId,
      });
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // These are expected and harmless — silence them:
      //  - "message to delete not found": user already deleted it, or 48h window passed
      //  - "message can't be deleted": admin msgs, service msgs, etc.
      if (/message to delete not found|message can't be deleted/i.test(msg)) {
        return false;
      }
      console.error(`[telegram] Failed to delete message ${messageId}:`, error);
      return false;
    }
  }

  async setWebhook(url: string): Promise<void> {
    await this.request("setWebhook", { url });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.request("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text: text ?? undefined,
    });
  }

  async deleteWebhook(): Promise<void> {
    await this.request("deleteWebhook", {});
  }

  private async request(method: string, body: Record<string, unknown>): Promise<unknown> {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 15_000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        const data = await response.json();
        if (!data.ok) {
          // Telegram 429 (rate limit) — wait and retry
          if (response.status === 429 && attempt < MAX_RETRIES) {
            const retryAfter = data.parameters?.retry_after ?? 1;
            console.warn(`[telegram] Rate limited on ${method}, retrying in ${retryAfter}s (attempt ${attempt}/${MAX_RETRIES})`);
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            continue;
          }
          throw new Error(`Telegram API error (${method}): ${data.description ?? "Unknown error"}`);
        }
        return data.result;
      } catch (error) {
        const isNetworkError =
          error instanceof TypeError ||
          (error instanceof DOMException && error.name === "TimeoutError");

        if (isNetworkError && attempt < MAX_RETRIES) {
          const delay = attempt * 1000; // 1s, 2s
          console.warn(`[telegram] ${method} failed (${(error as Error).message}), retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Telegram API ${method}: all ${MAX_RETRIES} attempts failed`);
  }
}
