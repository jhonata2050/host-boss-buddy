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

  // 2. Gateway Logic (AbacatePay Real vs Mock)
  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("*")
    .in("key", ["abacatepay_api_key"]);
  
  const apiKey = settings?.find(s => s.key === "abacatepay_api_key")?.value;
  const amount = Number(invoice.total_amount);

  if (typeof apiKey === 'string' && apiKey && !apiKey.includes("placeholder")) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // Real AbacatePay API Call
      const response = await fetch("https://api.abacatepay.com/v1/billing/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          frequency: "ONE_TIME",
          methods: [data.method.toUpperCase()],
          products: [{
            externalId: invoice.id,
            name: `Fatura #${invoice.id.slice(0, 8)}`,
            quantity: 1,
            unitPrice: Math.round(amount * 100), // Em centavos
          }],
          returnUrl: `${process.env['PUBLIC_URL'] || 'http://localhost:8080'}/invoices/${invoice.id}`,
          completionUrl: `${process.env['PUBLIC_URL'] || 'http://localhost:8080'}/invoices/${invoice.id}?success=true`,
          customer: {
            name: profile?.full_name || "Cliente HostPanel",
            email: profile?.email || "cliente@exemplo.com",
            taxId: profile?.tax_id || "000.000.000-00",
          }
        }),
      });

      if (response.ok) {
        const apData = await response.json();
        const gatewayRef = apData.data.id;
        
        // Create transaction record
        const { data: transaction } = await supabaseAdmin
          .from("transactions")
          .insert({
            user_id: userId,
            invoice_id: invoice.id,
            amount: amount,
            gateway: "abacatepay",
            gateway_reference: gatewayRef,
            status: "pending",
            metadata: { method: data.method, checkoutUrl: apData.data.url }
          })
          .select()
          .single();

        return {
          transactionId: transaction?.id,
          method: data.method,
          checkoutUrl: apData.data.url,
          amount: amount
        };
      }
    } catch (err) {
      console.error("AbacatePay API Error:", err);
    }
  }

  // 3. Fallback to Mock
  const gatewayRef = `mock_${Math.random().toString(36).slice(2, 11)}`;
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

  if (data.method === "pix") {
    return {
      transactionId: transaction.id,
      method: "pix",
      pixCode: "00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540510.005802BR5913HOSTPANEL INC6008SAO PAULO62070503***6304ABCD",
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=MOCK_PIX_CODE",
      amount: amount
    };
  }

  return {
    transactionId: transaction.id,
    method: data.method,
    checkoutUrl: `https://checkout.hostpanel.app/pay/${transaction.id}`,
    amount: amount
  };
}
