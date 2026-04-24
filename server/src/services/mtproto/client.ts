import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

export interface SendCodeResult {
  phoneCodeHash: string;
}

export interface SignInResult {
  ok: boolean;
  needsPassword: boolean;
  sessionString?: string;
}

export class MtprotoClient {
  private client: TelegramClient;

  constructor(
    private apiId: number,
    private apiHash: string,
    sessionString: string = "",
  ) {
    this.client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
      connectionRetries: 3,
    });
  }

  async connect(): Promise<void> {
    if (!this.client.connected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async sendCode(phoneNumber: string): Promise<SendCodeResult> {
    await this.connect();
    const result = await this.client.sendCode(
      { apiId: this.apiId, apiHash: this.apiHash },
      phoneNumber,
    );
    return { phoneCodeHash: result.phoneCodeHash };
  }

  async signIn(
    phoneNumber: string,
    phoneCodeHash: string,
    code: string,
  ): Promise<SignInResult> {
    try {
      await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code,
        }),
      );
      const sessionString = (this.client.session as StringSession).save();
      return { ok: true, needsPassword: false, sessionString };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("SESSION_PASSWORD_NEEDED")) {
        return { ok: false, needsPassword: true };
      }
      throw err;
    }
  }

  async signInWithPassword(password: string): Promise<SignInResult> {
    await this.client.signInUser(
      { apiId: this.apiId, apiHash: this.apiHash },
      {
        phoneNumber: async () => "",
        phoneCode: async () => "",
        password: async () => password,
        onError: (e) => { throw e; },
      },
    );
    const sessionString = (this.client.session as StringSession).save();
    return { ok: true, needsPassword: false, sessionString };
  }

  async sendMessage(
    target: string,
    targetType: "username" | "phone",
    text: string,
  ): Promise<void> {
    await this.connect();

    if (targetType === "username") {
      await this.client.sendMessage(target, { message: text });
      return;
    }

    const imported = await this.client.invoke(
      new Api.contacts.ImportContacts({
        contacts: [
          new Api.InputPhoneContact({
            clientId: BigInt(Date.now()) as unknown as bigint,
            phone: target,
            firstName: "lead",
            lastName: "",
          }),
        ],
      }),
    );
    const user = imported.users[0];
    if (!user) throw new Error("PHONE_NOT_ON_TELEGRAM");
    await this.client.sendMessage(user as never, { message: text });
  }
}
