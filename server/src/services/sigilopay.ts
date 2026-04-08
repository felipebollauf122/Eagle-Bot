interface CreatePixPaymentParams {
  identifier: string;
  amount: number; // in BRL (reais), e.g. 97.00
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocument: string;
  description?: string;
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
  private baseUrl = "https://app.sigilopay.com.br/api/v1";

  constructor(
    private publicKey: string,
    private secretKey: string,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.publicKey && this.secretKey);
  }

  async createPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult> {
    if (!this.isConfigured()) {
      throw new Error("Chaves SigiloPay não configuradas. Vá em Configurações do bot e preencha a Public Key e Secret Key.");
    }

    const payload = {
      identifier: params.identifier,
      amount: params.amount,
      description: params.description,
      client: {
        name: params.clientName,
        email: params.clientEmail,
        phone: params.clientPhone,
        document: params.clientDocument,
      },
      products: params.products,
      callbackUrl: params.callbackUrl,
      metadata: params.metadata,
    };

    console.log(`[sigilopay] Payload enviado:`, JSON.stringify(payload, null, 2));

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
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as Record<string, unknown>).message ?? response.statusText;
      throw new Error(`SigiloPay API erro (${response.status}): ${msg}`);
    }

    const data = await response.json();
    console.log(`SigiloPay: Pix payment created, txn ${data.transactionId}`);
    return {
      transactionId: data.transactionId,
      status: data.status,
      pixCode: data.pix.code,
      pixImage: data.pix.image ?? null,
      orderId: data.order.id,
    };
  }
}
