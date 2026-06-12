// src/utils/ticketFormat.ts
// Text formatting for thermal tickets — ported 1:1 from the web's
// client/src/Utils/ticketPrinter.js so app-printed tickets read identically
// to the ones the website generates.

/** "2026-06-07T00:00:00.000Z" | "2026-06-07" | Date | epoch → "07-06-2026" */
export function isoToDDMMYYYY(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';

  if (input instanceof Date && !isNaN(input.getTime())) {
    const dd = String(input.getDate()).padStart(2, '0');
    const mm = String(input.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${input.getFullYear()}`;
  }

  const s = String(input).trim();

  // ISO-like strings: read the components directly to avoid timezone shifts.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    return `${dd}-${mm}-${yyyy}`;
  }

  if (/^\d+$/.test(s)) {
    const d = new Date(Number(s));
    if (!isNaN(d.getTime())) return isoToDDMMYYYY(d);
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return isoToDDMMYYYY(parsed);

  return '';
}

/** Current time as "02:09 p.m." (es-MX 12h), like the web tickets show. */
export function formatTime12h(dateInput?: number | Date): string {
  const d = new Date(dateInput ?? Date.now());
  try {
    const s = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return String(s)
      .replace(/\s+/g, ' ')
      .replace(/a\.?\s?m\.?/i, 'a.m.')
      .replace(/p\.?\s?m\.?/i, 'p.m.');
  } catch {
    let hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const suffix = hh >= 12 ? 'p.m.' : 'a.m.';
    hh = hh % 12 || 12;
    return `${hh}:${mm} ${suffix}`;
  }
}

/** "Crédito" → "credito": accents/punctuation removed, lowercased. */
export function normalizePaymentForm(s: unknown): string {
  if (!s && s !== 0) return '';
  try {
    return String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  } catch {
    return String(s || '').toLowerCase();
  }
}

export function isCreditForm(formaDePago: unknown): boolean {
  const normalized = normalizePaymentForm(formaDePago);
  return /(msi|credito|apartado)/i.test(normalized);
}

export function isContadoForm(formaDePago: unknown): boolean {
  return /contado/.test(normalizePaymentForm(formaDePago));
}

export function isApartadoForm(formaDePago: unknown): boolean {
  return /apartado/.test(normalizePaymentForm(formaDePago));
}

export interface TicketModel {
  isPayment: boolean;
  products: any[];
  credit: boolean;
  contado: boolean;
  /** Apartado only tracks the promo price — receipts hide saldo normal. */
  apartado: boolean;
  clientName: string;
  folio: string;
  ticketDate: string;
  dueDate: string;
  total: string;
  formattedEnganche: string;
  paymentAmount: string;
  saldoNormal: string;
  saldoPromo: string;
}

/**
 * Field derivation shared by the thermal ticket (ReceiptTicket) and the
 * shareable PDF, so both renderings always show the same values/wording.
 */
export function deriveTicketModel(sale: any, payment?: any | null): TicketModel {
  const isPayment = Boolean(payment);

  const engancheNumber = Number(sale?.enganche ?? 0);
  const formattedEnganche = Number.isNaN(engancheNumber)
    ? '0.00'
    : engancheNumber.toFixed(2);

  const paymentAmountRaw = payment?.cantidad ?? payment?.amount ?? '0.00';
  const paymentAmountNum = Number(paymentAmountRaw);
  const paymentAmount = Number.isNaN(paymentAmountNum)
    ? String(paymentAmountRaw)
    : paymentAmountNum.toFixed(2);

  const saldoNormal = isPayment
    ? payment?.saldo_precio_normal ?? sale?.saldo_precio_normal ?? ''
    : sale?.saldo_precio_normal ?? '';
  const saldoPromo = isPayment
    ? payment?.saldo_precio_promocion ?? sale?.saldo_precio_promocion ?? ''
    : sale?.saldo_precio_promocion ?? '';

  return {
    isPayment,
    products: (sale?.products || []).filter(Boolean),
    credit: isCreditForm(sale?.formadepago),
    contado: isContadoForm(sale?.formadepago),
    apartado: isApartadoForm(sale?.formadepago),
    clientName: sale?.nombre || payment?.nombre || '---',
    folio: String(sale?.id ?? payment?.sale_id ?? '---'),
    ticketDate: isPayment
      ? isoToDDMMYYYY(payment?.fecha || sale?.fecha || new Date())
      : isoToDDMMYYYY(sale?.fecha),
    dueDate:
      isoToDDMMYYYY(sale?.fechavencimiento || payment?.fechavencimiento || '') ||
      '-',
    total: String(sale?.preciopromocion ?? sale?.total_price ?? sale?.total ?? '0.00'),
    formattedEnganche,
    paymentAmount,
    saldoNormal: String(saldoNormal ?? ''),
    saldoPromo: String(saldoPromo ?? ''),
  };
}
