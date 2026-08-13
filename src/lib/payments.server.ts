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

  // 2. Gateway Logic (AbacatePay vs Stripe vs Others)
  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("*")
    .in("key", ["abacatepay_api_key", "stripe_secret_key", "mercadopago_access_token", "woovi_api_key", "paghiper_api_key", "cajupay_api_key"]);
  
  const config = Object.fromEntries(settings?.map(s => [s.key, s.value]) || []);
  const amount = Number(invoice.total_amount);

  // ABACATEPAY
  if (data.gateway === "abacatepay" && config["abacatepay_api_key"] && !String(config["abacatepay_api_key"]).includes("placeholder")) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      const response = await fetch("https://api.abacatepay.com/v1/billing/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config["abacatepay_api_key"]}`,
        },
        body: JSON.stringify({
          frequency: "ONE_TIME",
          methods: [data.method.toUpperCase()],
          products: [{
            externalId: invoice.id,
            name: `Fatura #${invoice.id.slice(0, 8)}`,
            quantity: 1,
            unitPrice: Math.round(amount * 100),
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
        
        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          invoice_id: invoice.id,
          amount: amount,
          gateway: "abacatepay",
          gateway_reference: gatewayRef,
          status: "pending",
          metadata: { method: data.method, checkoutUrl: apData.data.url }
        });

        return { method: data.method, checkoutUrl: apData.data.url, amount };
      }
    } catch (err) {
      console.error("AbacatePay API Error:", err);
    }
  }

  // STRIPE (Simulated implementation for standard card flow)
  if (data.gateway === "stripe" && config["stripe_secret_key"]) {
    // Here we would typically use the stripe sdk: import Stripe from 'stripe'
    // For now, we simulate the redirect to a Stripe-like checkout
    const gatewayRef = `st_${Math.random().toString(36).slice(2, 11)}`;
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      invoice_id: invoice.id,
      amount: amount,
      gateway: "stripe",
      gateway_reference: gatewayRef,
      status: "pending",
      metadata: { method: "credit_card" }
    });
    return { method: "credit_card", checkoutUrl: `https://checkout.stripe.com/pay/${gatewayRef}`, amount };
  }

  // MERCADO PAGO (Simulated)
  if (data.gateway === "mercadopago" && config["mercadopago_access_token"]) {
    const gatewayRef = `mp_${Math.random().toString(36).slice(2, 11)}`;
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      invoice_id: invoice.id,
      amount: amount,
      gateway: "mercadopago",
      gateway_reference: gatewayRef,
      status: "pending",
      metadata: { method: data.method }
    });
    return { method: data.method, checkoutUrl: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${gatewayRef}`, amount };
  }

  // WOOVI (Simulated)
  if (data.gateway === "woovi" && config["woovi_api_key"]) {
    const gatewayRef = `woovi_${Math.random().toString(36).slice(2, 11)}`;
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      invoice_id: invoice.id,
      amount: amount,
      gateway: "woovi",
      gateway_reference: gatewayRef,
      status: "pending",
      metadata: { method: "pix" }
    });
    return { method: "pix", pixCode: "WOOVI_MOCK_PIX_CODE", qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=WOOVI_MOCK", amount };
  }

  // PAGHIPER (Simulated)
  if (data.gateway === "paghiper" && config["paghiper_api_key"]) {
    const gatewayRef = `ph_${Math.random().toString(36).slice(2, 11)}`;
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      invoice_id: invoice.id,
      amount: amount,
      gateway: "paghiper",
      gateway_reference: gatewayRef,
      status: "pending",
      metadata: { method: data.method }
    });
    return { method: data.method, checkoutUrl: `https://www.paghiper.com.br/checkout/boleto/${gatewayRef}`, amount };
  }

  // CAJUPAY (Simulated)
  if (data.gateway === "cajupay" && config["cajupay_api_key"]) {
    const gatewayRef = `caju_${Math.random().toString(36).slice(2, 11)}`;
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      invoice_id: invoice.id,
      amount: amount,
      gateway: "cajupay",
      gateway_reference: gatewayRef,
      status: "pending",
      metadata: { method: data.method }
    });
    return { method: data.method, checkoutUrl: `https://checkout.cajupay.com.br/${gatewayRef}`, amount };
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
