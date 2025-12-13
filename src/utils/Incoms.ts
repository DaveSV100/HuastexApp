// src/utils/incoms.ts
export function buildIncomePayload(sale: any) {
  const rawPayment = sale.formaDePago ?? sale.formadepago ?? '';
  const payment = rawPayment.toString().toLowerCase();

  const isCredit = ["crédito", "msi", "apartado"].includes(payment);
  const isCash = payment === "contado";
  const isCard = payment === "c/tarjeta";

  let productList = '(sin producto)';
  if (Array.isArray(sale.products) && sale.products.length) {
    productList = sale.products
      .map((p: any) => p.producto || p.title || p.name || '(sin nombre)')
      .join(', ');
  }

  const enganche = Number(sale.enganche ?? 0);
  const promoPrice = Number(sale.precioPromocion ?? 0);
  const saldoNorm = Number(sale.saldoPrecioNormal ?? sale.saldo_precio_normal ?? 0);
  const saldoPromo = Number(sale.saldoPrecioPromocion ?? sale.saldo_precio_promocion ?? 0);

  const value = isCash ? promoPrice : isCredit ? enganche : 0;
  const saldo = isCash ? 0 : saldoNorm;
  const porPagar = isCash ? 0 : saldoPromo;

  const paymentType = isCash ? "sale" : isCredit ? "down_payment" : isCard ? "credit_card" : "deposit";

  return {
    transaction_type: "income",
    name: sale.nombre ?? sale.name ?? "",
    product: productList,
    value: value,
    saldo: saldo,
    por_pagar: porPagar,
    transaction_date: sale.fecha ?? sale.transaction_date ?? new Date().toISOString().slice(0, 10),
    payment_type: paymentType,
    location: sale.sucursal ?? sale.location ?? ""
  };
}