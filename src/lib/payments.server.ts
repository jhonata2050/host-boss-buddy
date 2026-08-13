import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function createPaymentSession(
  userId: string,
  data: {
    invoiceId: string;
    method: "pix" | "credit_card" | "boleto";
    gateway: string;
  }
) {
  // 1. Fetch invoice
  const { data: invoice, error: iError } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", data.invoiceId)
    .eq("user_id", userId)
    .single();

  if (iError || !invoice) throw new Error("Fatura não encontrada");
  if (invoice.status === "paid") throw new Error("Fatura já está paga");

  // 2. Mock Gateway Logic (AbacatePay)
  // In a real scenario, we would call the AbacatePay API here.
  const amount = Number(invoice.total_amount);
  const gatewayRef = `mock_${Math.random().toString(36).slice(2, 11)}`;

  // 3. Create transaction record
  const { data: transaction, error: tError } = await supabaseAdmin
    .from("transactions")
    .insert({
      user_id: userId,
      invoice_id: invoice.id,
      amount: amount,
      gateway: data.gateway,
      gateway_reference: gatewayRef,
      status: "pending",
      metadata: { method: data.method }
    })
    .select()
    .single();

  if (tError || !transaction) throw new Error("Erro ao criar transação");

  // 4. Return payment info
  // For Pix, we might return a copy-paste code or QR code URL
  if (data.method === "pix") {
    return {
      transactionId: transaction.id,
      method: "pix",
      pixCode: "00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540510.005802BR5913HOSTPANEL INC6008SAO PAULO62070503***6304ABCD",
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=MOCK_PIX_CODE",
      amount: amount
    };
  }

  // Mock redirect for other methods
  return {
    transactionId: transaction.id,
    method: data.method,
    checkoutUrl: `https://checkout.hostpanel.app/pay/${transaction.id}`,
    amount: amount
  };
}
