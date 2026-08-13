# Phase 2 & 3: Financial System Completion & Payments

Finish the financial system (Phase 2) and implement the multi-gateway payment layer (Phase 3) with a focus on AbacatePay.

## User Experience
- **Invoice Details**: High-fidelity page for viewing and paying an invoice.
- **Payment Flow**: Selection of payment methods (Pix, Credit Card, Boleto) via AbacatePay and others.
- **Service Management**: "My Services" page for clients to see active hosting plans.
- **Admin Dashboard**: Real-time sales metrics and financial status.

## Technical Details

### Database & Security
- Ensure `transactions` table tracks gateway references and metadata.
- RLS policies for `services` to allow users to view their own services.
- `GRANT` statements for any new tables or functions.

### Server Functions (`src/lib/payments.functions.ts`)
- `initializePayment`: Creates a checkout session or returns payment details (Pix QR, etc.) for a specific gateway.
- `getPaymentStatus`: Polls or checks the current status of a transaction.
- `handleWebhook`: (Route handler) Processes asynchronous payment notifications.

### Frontend
- `src/routes/_authenticated/invoices.$invoiceId.tsx`: Detailed view with itemized list and "Pay" buttons.
- `src/routes/_authenticated/services.tsx`: Client-facing services list.
- Integration of `AbacatePay` UI references (lime branding, specific icons).

### Integrations
- **AbacatePay**: Primary gateway implementation using their public API/SDK.
- **Stripe/Woovi/others**: Placeholders for future expansion.

## Components
- `InvoiceDetailCard`: Reusable component for showing invoice status and items.
- `PaymentMethodSelector`: UI for choosing between Pix, Card, etc.
- `ServiceCard`: List item for active/suspended services.
