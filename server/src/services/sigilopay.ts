interface CreatePixPaymentParams {
  identifier: string;
  amount: number; // in BRL (reais), e.g. 97.00
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocument: string;
  products?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number; // in BRL
  }>;
  callbackUrl: string;
  metadata?: Record<string, string>;
}

interface PixPaymentResult {
  transactionId: string;
  status: string;
  pixCode: string;
  pixImage: string | null;
  orderId: string;
}

export class SigiloPay {
  private baseUrl = "https://app.poseidonpay.site/api/v1";

  constructor(
    private publicKey: string,
    private secretKey: string,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.publicKey && this.secretKey);
  }

  async createPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult> {
    if (!this.isConfigured()) {
      throw new Error("Chaves Poseidon Pay não configuradas. Vá em Configurações do bot e preencha a Public Key e Secret Key.");
    }

    const payload: Record<string, unknown> = {
      identifier: params.identifier,
      amount: params.amount,
      client: {
        name: params.clientName,
        email: params.clientEmail,
        phone: params.clientPhone,
        document: params.clientDocument,
      },
      callbackUrl: params.callbackUrl,
      metadata: params.metadata,
    };

    if (params.products && params.products.length > 0) {
      payload.products = params.products;
    }

    console.log(`[sigilopay] Payload enviado:`, JSON.stringify(payload, null, 2));
    console.log(
      `[sigilopay] Auth: url=${this.baseUrl}/gateway/pix/receive | pub_len=${this.publicKey.length} pub_prefix="${this.publicKey.slice(0, 8)}" pub_suffix="${this.publicKey.slice(-4)}" | sec_len=${this.secretKey.length} sec_prefix="${this.secretKey.slice(0, 8)}" sec_suffix="${this.secretKey.slice(-4)}"`,
    );

    const response = await fetch(`${this.baseUrl}/gateway/pix/receive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-public-key": this.publicKey,
        "x-secret-key": this.secretKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const rawBody = await response.text().catch(() => "");
      const server = response.headers.get("server") ?? "unknown";
      const cfRay = response.headers.get("cf-ray") ?? "none";
      console.error(
        `[poseidonpay] Erro ${response.status} ${response.statusText} | server=${server} cf-ray=${cfRay} | body: ${rawBody.slice(0, 500)}`,
      );
      let msg: string | unknown = response.statusText;
      try {
        const parsed = JSON.parse(rawBody) as Record<string, unknown>;
        msg = parsed.message ?? parsed.errorCode ?? response.statusText;
      } catch {
        msg = rawBody.slice(0, 200) || response.statusText;
      }
      throw new Error(`Poseidon Pay API erro (${response.status}): ${msg}`);
    }

    const data = await response.json();
    console.log(`[poseidonpay] Pix payment created, txn ${data.transactionId}`);
    return {
      transactionId: data.transactionId,
      status: data.status,
      pixCode: data.pix.code,
      pixImage: data.pix.image ?? null,
      orderId: data.order.id,
    };
  }
}
