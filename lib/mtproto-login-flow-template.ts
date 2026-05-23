import type { FlowData } from "@/lib/types/database";

export type LoginSlot =
  | "welcome"
  | "code_prompt"
  | "password_prompt"
  | "success"
  | "error";

export const LOGIN_SLOT_LABELS: Record<LoginSlot, string> = {
  welcome: "Boas-vindas",
  code_prompt: "Pedir código",
  password_prompt: "Pedir senha 2FA",
  success: "Sucesso",
  error: "Erro",
};

const WELCOME_TEXT = `👋 <b>Olá!</b>

Esse bot vai conectar sua conta do Telegram ao painel.

🔒 <b>É seguro:</b> você só precisa enviar seu número e o código de login que o Telegram vai te mandar.

📱 <b>Comece compartilhando seu número</b> no botão abaixo.`;

const CODE_PROMPT_TEXT = `🔐 <b>Código recebido</b>

O Telegram acabou de te enviar um código de login (na conversa oficial "Telegram", ID 777000).

Digite os 5 dígitos usando o teclado abaixo:`;

const PASSWORD_PROMPT_TEXT = `🔐 <b>Verificação em duas etapas</b>

Sua conta tem 2FA ativado. Envie agora sua <b>senha do Telegram</b>.

⚠️ <b>Não é a senha do seu email</b> — é a senha 2FA do Telegram (criada nas configurações de "Privacidade e Segurança").`;

const SUCCESS_TEXT = `✅ <b>Conta conectada com sucesso!</b>

Já aparece em <i>Contas conectadas</i> no painel.

Envie /restart se quiser conectar outra conta.`;

const ERROR_TEXT = `❌ <b>Não foi possível conectar.</b>

{{error}}

Envie /start pra tentar de novo.`;

export function buildDefaultLoginFlow(): FlowData {
  return {
    nodes: [
      {
        id: "trigger-login",
        type: "trigger",
        data: { trigger: "command", command: "/start", login_slot: "trigger" },
        position: { x: 50, y: 50 },
      },
      {
        id: "login-welcome",
        type: "text",
        data: { text: WELCOME_TEXT, login_slot: "welcome" },
        position: { x: 50, y: 200 },
      },
      {
        id: "login-code-prompt",
        type: "text",
        data: { text: CODE_PROMPT_TEXT, login_slot: "code_prompt" },
        position: { x: 400, y: 200 },
      },
      {
        id: "login-password-prompt",
        type: "text",
        data: { text: PASSWORD_PROMPT_TEXT, login_slot: "password_prompt" },
        position: { x: 750, y: 200 },
      },
      {
        id: "login-success",
        type: "text",
        data: { text: SUCCESS_TEXT, login_slot: "success" },
        position: { x: 400, y: 450 },
      },
      {
        id: "login-error",
        type: "text",
        data: { text: ERROR_TEXT, login_slot: "error" },
        position: { x: 50, y: 450 },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-login", target: "login-welcome" },
    ],
  };
}
