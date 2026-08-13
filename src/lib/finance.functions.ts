import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const orderInputSchema = z.object({
  productId: z.string(),
  billingCycle: z.enum(["monthly", "quarterly", "semiannually", "annually", "biennially"]),
  couponCode: z.string().optional(),
  domain: z.string().optional(),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => orderInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Note: session is expected to be provided by middleware
    const { userId } = (context as any);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // 1. Get product and price
    const { data: product, error: pError } = await supabaseAdmin
      .from("products")
      .select("*, product_prices(*)")
      .eq("id", data.productId)
      .single();

    if (pError || !product) throw new Error("Product not found");

    const price = product.product_prices.find((p: any) => p.cycle === data.billingCycle && p.is_active);
    if (!price) throw new Error("Price not found for this cycle");

    let totalAmount = price.price;
    let discountAmount = 0;
    let couponId = null;

    // 2. Validate coupon if provided
    if (data.couponCode) {
      const { data: coupon, error: cError } = await supabaseAdmin
        .from("coupons")
        .select("*")
        .eq("code", data.couponCode)
        .eq("is_active", true)
        .single();

      if (!cError && coupon) {
        // Simple validation: check date
        const isValidDate = !coupon.valid_until || new Date(coupon.valid_until) > new Date();
        const isValidUses = !coupon.max_uses || (coupon.used_count || 0) < coupon.max_uses;

        if (isValidDate && isValidUses) {
          couponId = coupon.id;
          if (coupon.type === "percentage") {
            discountAmount = (totalAmount * coupon.value) / 100;
          } else {
            discountAmount = Math.min(totalAmount, coupon.value);
          }
          totalAmount -= discountAmount;
        }
      }
    }

    // 3. Create Order
    const { data: order, error: oError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        coupon_id: couponId,
        total_amount: totalAmount,
        status: "pending",
      })
      .select()
      .single();

    if (oError) throw new Error("Failed to create order");

    // 4. Create Service (Pending)
    const { data: service, error: sError } = await supabaseAdmin
      .from("services")
      .insert({
        user_id: userId,
        product_id: data.productId,
        order_id: order.id,
        status: "pending",
        domain: data.domain || null,
        billing_cycle: data.billingCycle,
      })
      .select()
      .single();

    if (sError) throw new Error("Failed to create service");

    // 5. Create Invoice
    const { data: invoice, error: iError } = await supabaseAdmin
      .from("invoices")
      .insert({
        user_id: userId,
        order_id: order.id,
        total_amount: totalAmount,
        subtotal: price.price,
        discount_amount: discountAmount,
        due_date: new Date().toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (iError) throw new Error("Failed to create invoice");

    // 6. Create Invoice Item
    await supabaseAdmin.from("invoice_items").insert({
      invoice_id: invoice.id,
      service_id: service.id,
      description: `${product.name} - ${data.billingCycle}`,
      amount: price.price,
    });

    // 7. Update coupon use count if applicable
    if (couponId) {
      await supabaseAdmin.rpc("increment_coupon_uses" as any, { _coupon_id: couponId });
    }

    return { orderId: order.id, invoiceId: invoice.id };
  });

export const getInvoiceDetails = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = (context as any);
    if (!userId) throw new Error("Unauthorized");

    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();

    if (error || !invoice) throw new Error("Invoice not found");

    return invoice;
  });
