"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockPaymentGateway = void 0;
class MockPaymentGateway {
    async chargeCard(amount, token) {
        return {
            success: amount > 0 && token.length > 0,
            referenceId: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        };
    }
    async generateKHQR(amount, orderId) {
        const referenceId = `khqr_${orderId}_${Date.now()}`;
        return {
            qrPayload: `00020101021229...${amount.toFixed(2)}***${referenceId}`,
            referenceId,
        };
    }
    async verifyKHQR(referenceId) {
        return { paid: referenceId.startsWith("khqr_") };
    }
}
exports.MockPaymentGateway = MockPaymentGateway;
//# sourceMappingURL=gateway.js.map