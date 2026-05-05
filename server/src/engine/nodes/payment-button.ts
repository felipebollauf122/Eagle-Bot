import type { SupabaseClient } from "@supabase/supabase-js";
import type { NodeContext, NodeResult } from "../types.js";
import type { SigiloPay } from "../../services/sigilopay.js";
import { UtmifyService } from "../../services/utmify.js";
import { FacebookCapi } from "../../services/facebook-capi.js";
import { TrackingService } from "../../services/tracking-service.js";
import { addPaymentTimeoutJob } from "../../queue.js";

interface BundleProduct {
  id: string;
  name: string;
  price: number; // cents
  currency: string;
  is_active: boolean;
  ghost_name: string | null;
  ghost_description: string | null;
}

interface BundleItem {
  id: string;
  product_id: string;
  sort_order: number;
  products: BundleProduct;
}

interface Bundle {
  id: string;
  name: string;
  message_text: string;
  is_active: boolean;
  product_bundle_items: BundleItem[];
}

export async function handlePaymentBundleNode(
  ctx: NodeContext,
  db: SupabaseClient,
  _sigiloPay: SigiloPay,
  _baseWebhookUrl: string,
): Promise<NodeResult> {
  const bundleId = String(ctx.node.data.bundle_id ?? "");

  if (!bundleId) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Erro: nenhum conjunto de produtos configurado.",
    });
    return { nextNodeId: null };
  }

  // Fetch bundle with products
  const { data: bundle, error } = await db
    .from("product_bundles")
    .select("id, name, message_text, is_active, product_bundle_items(id, product_id, sort_order, products(id, name, price, currency, is_active, ghost_name, ghost_description))")
    .eq("id", bundleId)
    .single();

  if (error || !bundle) {
    console.error(`[payment_button] Bundle not found: ${bundleId}`, error);
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Desculpe, os produtos estão indisponíveis no momento.",
    });
    return { nextNodeId: null };
  }

  const typedBundle = bundle as unknown as Bundle;

  // Filter only active products and sort
  const items = typedBundle.product_bundle_items
    .filter((item) => item.products && item.products.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (items.length === 0) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Desculpe, não há produtos disponíveis no momento.",
    });
    return { nextNodeId: null };
  }

  // No black flow o cliente vê o ghost_name (fallback pro nome real).
  // No white flow ele sempre vê o nome real.
  const isBlack = ctx.lead.active_flow_name === "_black_flow";

  // Build inline keyboard — one button per product with name + price
  const inlineKeyboard = items.map((item) => {
    const product = item.products;
    const displayName = isBlack ? (product.ghost_name || product.name) : product.name;
    const priceInReais = product.price / 100;
    const priceFormatted = priceInReais.toLocaleString("pt-BR", {
      style: "currency",
      currency: product.currency,
    });
    return [
      {
        text: `${displayName} por ${priceFormatted}`,
        callback_data: `pay:${product.id}`,
      },
    ];
  });

  // Send single message with header text + all product buttons
  const messageIds: number[] = [];
  const msg = await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: typedBundle.message_text,
    replyMarkup: { inline_keyboard: inlineKeyboard },
  });
  if (msg) messageIds.push(msg.message_id);

  // Fire view_offer → Facebook ViewContent
  const { data: botForTracking } = await db
    .from("bots")
    .select("facebook_pixel_id, facebook_access_token, utmify_api_key")
    .eq("id", ctx.lead.bot_id)
    .single();

  if (botForTracking) {
    const fbCapi = new FacebookCapi(botForTracking.facebook_pixel_id ?? "", botForTracking.facebook_access_token ?? "");
    const utmSvc = new UtmifyService(botForTracking.utmify_api_key ?? "");
    const trackingSvc = new TrackingService(db, fbCapi, utmSvc);
    trackingSvc.trackViewOffer({
      tenantId: ctx.lead.tenant_id,
      leadId: ctx.lead.id,
      botId: ctx.lead.bot_id,
      lead: {
        id: ctx.lead.id,
        tid: ctx.lead.tid,
        fbclid: ctx.lead.fbclid,
        firstName: ctx.lead.first_name,
        utmSource: ctx.lead.utm_source ?? undefined,
        utmMedium: ctx.lead.utm_medium ?? undefined,
        utmCampaign: ctx.lead.utm_campaign ?? undefined,
        utmContent: ctx.lead.utm_content ?? undefined,
        utmTerm: ctx.lead.utm_term ?? undefined,
      },
      contentName: typedBundle.name,
    }).catch((e) => console.error("[tracking] Failed to track view_offer:", e));
  }

  // Save state: we're waiting for a product selection
  return {
    nextNodeId: "wait",
    messageIds: messageIds.length > 0 ? messageIds : undefined,
    stateUpdates: {
      pending_payment_node_id: ctx.node.id,
      pending_bundle_id: bundleId,
      awaiting_product_selection: true,
    },
  };
}

// Handle when user clicks a "pay" button — called from flow-processor
export async function handleProductPaymentCallback(
  ctx: NodeContext,
  db: SupabaseClient,
  sigiloPay: SigiloPay,
  baseWebhookUrl: string,
  productId: string,
): Promise<NodeResult> {
  // Fetch product
  const { data: product } = await db
    .from("products")
    .select("id, name, price, currency, is_active, ghost_name, ghost_description")
    .eq("id", productId)
    .single();

  if (!product) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Desculpe, este produto está indisponível.",
    });
    return { nextNodeId: "wait" };
  }

  const typedProduct = product as BundleProduct;
  // Black flow: cliente vê ghost_name (fallback pro real). White flow: cliente vê nome real.
  // Gateway e tracking sempre recebem typedProduct.name (nome real).
  const isBlack = ctx.lead.active_flow_name === "_black_flow";
  const displayName = isBlack ? (typedProduct.ghost_name || typedProduct.name) : typedProduct.name;
  console.log(`[payment] isBlack=${isBlack}, ghost_name="${typedProduct.ghost_name}", displayName="${displayName}"`);
  const identifier = `eaglebot_${ctx.lead.id}_${Date.now()}`;
  const amountInReais = typedProduct.price / 100;

  // Build client data from lead info (fallbacks are valid test values)
  const clientEmail = String(ctx.lead.state.email ?? `${ctx.lead.telegram_user_id}@eaglebot.temp`);
  const clientPhone = String(ctx.lead.state.phone ?? "11999999999");
  const clientDocument = String(ctx.lead.state.document ?? "52998224725");

  // Single webhook URL for the entire platform (not per-bot) to avoid
  // hitting SigiloPay's 20-webhook limit. The bot is resolved from the
  // transaction record when the callback arrives.
  const callbackUrl = `${baseWebhookUrl}/webhook/payment`;

  // Instant feedback — send before generating pix (fire-and-forget)
  const loadingMsg = await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: "⏳ Gerando seu Pix, aguarde...",
  });

  let payment;
  try {
    payment = await sigiloPay.createPixPayment({
      identifier,
      amount: amountInReais,
      clientName: ctx.lead.first_name,
      clientEmail,
      clientPhone,
      clientDocument,
      // Gateway SEMPRE recebe o nome real do produto.
      // O ghost_name é apenas para exibição ao cliente (tanto no black quanto no white flow).
      products: [
        {
          id: typedProduct.id,
          name: typedProduct.name,
          quantity: 1,
          price: amountInReais,
        },
      ],
      callbackUrl,
      metadata: {
        provider: "eaglebot",
        orderId: identifier,
        lead_id: ctx.lead.id,
        bot_id: ctx.lead.bot_id,
        flow_id: ctx.lead.current_flow_id ?? "",
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[payment] SigiloPay failed for product ${productId}, lead ${ctx.lead.id}:`, errorMsg);
    // Delete loading message on error
    if (loadingMsg) {
      ctx.telegram.deleteMessage(ctx.chatId, loadingMsg.message_id).catch(() => {});
    }
    // Strip any HTML/tags and cap length to avoid Telegram parse errors
    const safeMsg = errorMsg.replace(/<[^>]*>/g, "").replace(/[<>&]/g, "").slice(0, 200);
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: `⚠️ Erro no pagamento: ${safeMsg}`,
    });
    return { nextNodeId: "wait" };
  }

  // Create transaction record. flow_id pode ser null (ex: pagamento gerado
  // dentro de um flow de remarketing, que não está em `flows`).
  const { data: txRecord } = await db.from("transactions").insert({
    tenant_id: ctx.lead.tenant_id,
    lead_id: ctx.lead.id,
    bot_id: ctx.lead.bot_id,
    flow_id: ctx.lead.current_flow_id ?? null,
    product_id: typedProduct.id,
    gateway: "sigilopay",
    external_id: payment.transactionId,
    amount: typedProduct.price,
    currency: typedProduct.currency,
    status: "pending",
  }).select("id").single();

  // Fire checkout (Facebook InitiateCheckout) + Utmify waiting_payment
  const { data: botConfig } = await db
    .from("bots")
    .select("facebook_pixel_id, facebook_access_token, utmify_api_key")
    .eq("id", ctx.lead.bot_id)
    .single();

  if (botConfig) {
    const fbCapi = new FacebookCapi(botConfig.facebook_pixel_id ?? "", botConfig.facebook_access_token ?? "");
    const utmSvc = new UtmifyService(botConfig.utmify_api_key ?? "");
    const trackingSvc = new TrackingService(db, fbCapi, utmSvc);

    const leadInfo = {
      id: ctx.lead.id,
      tid: ctx.lead.tid,
      fbclid: ctx.lead.fbclid,
      firstName: ctx.lead.first_name,
      email: clientEmail,
      phone: clientPhone,
      utmSource: ctx.lead.utm_source ?? undefined,
      utmMedium: ctx.lead.utm_medium ?? undefined,
      utmCampaign: ctx.lead.utm_campaign ?? undefined,
      utmContent: ctx.lead.utm_content ?? undefined,
      utmTerm: ctx.lead.utm_term ?? undefined,
      telegramUserId: ctx.lead.telegram_user_id,
      botId: ctx.lead.bot_id,
    };

    // Facebook InitiateCheckout event
    trackingSvc.trackCheckout({
      tenantId: ctx.lead.tenant_id,
      leadId: ctx.lead.id,
      botId: ctx.lead.bot_id,
      amount: typedProduct.price,
      currency: typedProduct.currency,
      lead: leadInfo,
      productId: typedProduct.id,
      productName: typedProduct.name,
    }).catch((e) => console.error("[tracking] Failed to track checkout:", e));

    // Utmify waiting_payment
    if (botConfig.utmify_api_key) {
      utmSvc.sendOrder({
        orderId: txRecord?.id ?? payment.transactionId,
        status: "waiting_payment",
        platform: "eaglebot",
        paymentMethod: "pix",
        customer: {
          name: ctx.lead.first_name,
          email: clientEmail,
          phone: clientPhone,
          document: clientDocument,
        },
        products: [{
          id: typedProduct.id,
          name: typedProduct.name,
          priceInCents: String(typedProduct.price),
          quantity: 1,
        }],
        trackingParameters: {
          src: ctx.lead.tid ?? null,
          sck: ctx.lead.fbclid ?? null,
          utm_source: ctx.lead.utm_source ?? undefined,
          utm_medium: ctx.lead.utm_medium ?? undefined,
          utm_campaign: ctx.lead.utm_campaign ?? undefined,
          utm_content: ctx.lead.utm_content ?? undefined,
          utm_term: ctx.lead.utm_term ?? undefined,
        },
      }).catch((e) => console.error("[utmify] Failed to send waiting_payment:", e));
    }
  }

  const priceFormatted = amountInReais.toLocaleString("pt-BR", {
    style: "currency",
    currency: typedProduct.currency,
  });

  console.log(`[payment] pixImage from SigiloPay: ${payment.pixImage ?? "null"}`);

  // Generate QR code URL from pix code if SigiloPay didn't provide one
  const qrCodeUrl = payment.pixImage
    || `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(payment.pixCode)}`;

  // Delete loading message now that pix is ready
  if (loadingMsg) {
    ctx.telegram.deleteMessage(ctx.chatId, loadingMsg.message_id).catch(() => {});
  }

  // Send payment details with QR Code button
  const paymentMsg = await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: [
      `🌟 Você selecionou o seguinte plano:`,
      ``,
      `🎁 Plano: ${displayName}`,
      `💰 Valor: ${priceFormatted}`,
      ``,
      `💳 Total: ${priceFormatted}`,
      ``,
      `💠 Pague via Pix Copia e Cola:`,
      ``,
      `<code>${payment.pixCode}</code>`,
      ``,
      `👆 Toque no código acima para copiá-lo`,
      ``,
      `‼️ Após o pagamento seu acesso será liberado automaticamente.`,
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{ text: "📋 Copiar código Pix", copy_text: { text: payment.pixCode } }],
        [{ text: "📱 Ver QR Code", callback_data: `qrcode:${ctx.node.id}` }],
      ],
    },
  });

  // Schedule payment timeout — fires "not_paid" edge if payment not confirmed in time
  const timeoutMinutes = Number(ctx.node.data.payment_timeout_minutes ?? 15);
  if (timeoutMinutes > 0 && ctx.lead.current_flow_id) {
    addPaymentTimeoutJob(
      {
        leadId: ctx.lead.id,
        flowId: ctx.lead.current_flow_id,
        paymentNodeId: ctx.node.id,
        externalTransactionId: payment.transactionId,
        botId: ctx.lead.bot_id,
        tenantId: ctx.lead.tenant_id,
        chatId: ctx.chatId,
      },
      timeoutMinutes * 60,
    ).catch((e) => console.error("[payment] Failed to schedule timeout:", e));
  }

  return {
    nextNodeId: "wait",
    messageIds: paymentMsg ? [paymentMsg.message_id] : undefined,
    stateUpdates: {
      pending_transaction_id: payment.transactionId,
      pending_payment_node_id: ctx.node.id,
      pending_identifier: identifier,
      pending_pix_code: payment.pixCode,
      pending_pix_image: qrCodeUrl,
      awaiting_product_selection: false,
    },
  };
}
