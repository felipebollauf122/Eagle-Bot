import { SigiloPay } from "./sigilopay.js";
import { EvPay } from "./evpay.js";
import type { PaymentGateway } from "./payment-gateway.js";

interface BotPaymentConfig {
  payment_gateway?: string | null;
  sigilopay_public_key?: string | null;
  sigilopay_secret_key?: string | null;
  evpay_api_key?: string | null;
  evpay_project_id?: string | null;
}

export function getGatewayKind(bot: BotPaymentConfig): "sigilopay" | "evpay" {
  return bot.payment_gateway === "evpay" ? "evpay" : "sigilopay";
}

export function buildGateway(bot: BotPaymentConfig): {
  gateway: PaymentGateway;
  kind: "sigilopay" | "evpay";
} {
  const kind = getGatewayKind(bot);
  if (kind === "evpay") {
    return {
      gateway: new EvPay(bot.evpay_api_key ?? "", bot.evpay_project_id ?? ""),
      kind: "evpay",
    };
  }
  return {
    gateway: new SigiloPay(bot.sigilopay_public_key ?? "", bot.sigilopay_secret_key ?? ""),
    kind: "sigilopay",
  };
}
