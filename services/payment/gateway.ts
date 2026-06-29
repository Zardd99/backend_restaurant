export interface CardChargeResult {
  success: boolean;
  referenceId: string;
}

export interface KHQRGenerateResult {
  qrPayload: string;
  referenceId: string;
}

export interface KHQRVerifyResult {
  paid: boolean;
}

/**
 * Payment provider boundary. Swap MockPaymentGateway for a real Bakong/KHQR +
 * card processor implementation without touching the payment use case.
 */
export interface PaymentGateway {
  chargeCard(amount: number, token: string): Promise<CardChargeResult>;
  generateKHQR(amount: number, orderId: string): Promise<KHQRGenerateResult>;
  verifyKHQR(referenceId: string): Promise<KHQRVerifyResult>;
}

export class MockPaymentGateway implements PaymentGateway {
  async chargeCard(amount: number, token: string): Promise<CardChargeResult> {
    return {
      success: amount > 0 && token.length > 0,
      referenceId: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  async generateKHQR(
    amount: number,
    orderId: string,
  ): Promise<KHQRGenerateResult> {
    const referenceId = `khqr_${orderId}_${Date.now()}`;
    return {
      qrPayload: `00020101021229...${amount.toFixed(2)}***${referenceId}`,
      referenceId,
    };
  }

  async verifyKHQR(referenceId: string): Promise<KHQRVerifyResult> {
    return { paid: referenceId.startsWith("khqr_") };
  }
}
