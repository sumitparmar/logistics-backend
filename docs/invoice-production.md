# MoveKart Invoice Operations

## Delivery flow

An invoice is created only after an order is persisted with status `DELIVERED` and its customer is verified. The same processor is used by Borzo webhooks, order synchronization, admin status changes, bulk admin status changes, and the five-minute recovery job.

The processor is idempotent on the order unique index. Invoice numbering is allocated atomically from `InvoiceSequence` using the configured prefix and financial year. Financial values, customer information, delivery details, payment state, tax classification, and line items are stored as immutable snapshots. The PDF is generated once, stored in MongoDB with a SHA-256 checksum, and reused for later downloads and email attachments.

Email delivery is asynchronous through Bull and Redis. It has five attempts with exponential backoff, an atomic claim token, stale-claim recovery, and persisted `PENDING`, `QUEUED`, `SENT`, `FAILED`, or `NOT_AVAILABLE` state. Email failure never changes the delivery status.

## Required live configuration

Set these values in the backend environment. Do not commit secrets.

```text
EMAIL_HOST
EMAIL_PORT
EMAIL_SECURE
EMAIL_USER
EMAIL_PASS
EMAIL_FROM
EMAIL_FROM_NAME
REDIS_URL                  # or REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
```

Invoice legal configuration can be supplied through the admin Settings page. Environment values are the fallback for deployments where the settings document has not been configured:

```text
INVOICE_LEGAL_NAME
INVOICE_BUSINESS_ADDRESS
INVOICE_BUSINESS_STATE
INVOICE_BUSINESS_STATE_CODE
INVOICE_GSTIN
INVOICE_PAN
INVOICE_SAC_CODE
INVOICE_PREFIX
INVOICE_FINANCIAL_YEAR_START_MONTH
INVOICE_TEMPLATE_VERSION
INVOICE_SUPPORT_EMAIL
INVOICE_SUPPORT_PHONE
INVOICE_LOGO_PATH              # optional; bundled MoveKart logo is the default
```

The admin Settings value takes precedence over the corresponding environment fallback. State tax treatment is classified as intra-state or inter-state only when both business and customer state codes are present. Otherwise the invoice remains explicitly `UNCLASSIFIED`; the system does not infer a jurisdiction.

## API surface

Customer routes are authenticated and owner-scoped:

```text
GET  /api/invoices/:orderId
GET  /api/invoices/:orderId/download
POST /api/invoices/:orderId/email
```

Admin routes require the existing order permissions:

```text
GET  /api/admin/invoices/:orderId
GET  /api/admin/invoices/:orderId/download
POST /api/admin/invoices/:orderId/email
```

Downloads return the stored PDF only, with private no-store caching and a safe `Content-Disposition` filename. The resend endpoint queues email and is rate-limited.

## Deployment checks

1. Configure the legal invoice fields and verify one generated invoice against the registered business details.
2. Verify SMTP credentials and `EMAIL_FROM` with a real customer mailbox.
3. Verify the production Redis connection and that the invoice worker starts with the API process.
4. Allow MongoDB to create the unique indexes for `Invoice.order`, `Invoice.invoiceNumber`, and `InvoiceSequence.key` during deployment.
5. Deliver a controlled test order and verify PDF download, email attachment, invoice number, tax classification, COD/payment display, and retry state.
6. Confirm that SMS and payment-gateway integrations remain external boundaries. COD is available through the existing order/payment flow; no fake gateway settlement is recorded as a successful payment.

Older invoice documents without snapshots or stored PDFs are upgraded only when their delivered order is accessed or the recovery job sees them. Their original stored subtotal, tax, total, and line items are preserved; missing historical metadata is marked with the legacy template version rather than recalculated.
