# Payment Gateway Production Boundary

MoveKart currently supports live order checkout through the provider's cash payment flow. Online checkout is deliberately hidden until a real gateway is configured; it is never represented as a successful payment by the client.

## Current flow

- `CASH` creates the delivery directly and records the order payment as `PENDING`.
- The provider payload uses its cash payment-point fields. MoveKart does not send an unsupported `COD` payment method to the provider.
- A parcel collection amount is sent only when the order payload includes a positive `cod.amount`; it is written to the final drop point as the provider cash-voucher amount.
- COD settlement is credited only after the provider reports delivery and is idempotent on the provider order reference.

## Gateway integration boundary

- `POST /api/payments/intent` creates an internal payment intent before creating the configured gateway order.
- Non-production `PAYMENT_GATEWAY_MODE=MOCK` is available for checkout testing only.
- Production mock confirmation is disabled unconditionally.
- Razorpay credentials enable the existing hosted checkout and signature verification flow:
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`.
- The payment intent, signature verification, webhook, refund, and wallet-credit paths are kept behind the payment service/controller boundary. Replacing the gateway later is limited to the gateway provider adapter plus gateway-specific webhook/checkout details.

## Release checks

1. Keep `PAYMENT_GATEWAY_MODE` unset in production until the real gateway credentials and webhook secret are available.
2. Confirm `/api/payments` returns cash only while online gateway credentials are absent.
3. Confirm a cash order reaches the provider and appears as `PENDING` payment in MoveKart.
4. Run one non-production mock checkout and one production-like signature/webhook test before enabling online methods.
