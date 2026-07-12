// src/utils/whatsapp.ts
// WhatsApp helpers for customer messaging: payment reminders (text via the
// whatsapp:// scheme / wa.me fallback) and receipt images (react-native-share
// shareSingle, which targets a specific number where the platform allows it).
//
// Phone numbers live on each sale as 10-digit Mexican numbers most of the
// time, but older rows sometimes carry the 52 / 521 prefix already, so
// normalizePhoneMx handles all three shapes.
import { Alert, Linking } from 'react-native';
import Share, { Social } from 'react-native-share';
import type { PaymentInfo } from './paymentStatus';

/**
 * Digits-only phone in international format (no "+").
 * 10 digits → assume Mexico and prepend 52; "521..." (legacy WhatsApp MX
 * format) collapses to 52; anything under 10 digits is unusable → null.
 */
export function normalizePhoneMx(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 13 && digits.startsWith('521')) {
    return `52${digits.slice(3)}`;
  }
  if (digits.length >= 11) return digits;
  return null;
}

/**
 * Reminder wording requested by the owner. The amount is how far behind the
 * plan the customer is; when nothing is "atrasado" yet (e.g. vencida sales
 * with no installments) it falls back to the outstanding saldo — the normal
 * saldo with surcharge once the promo window is gone.
 */
export function buildPaymentReminder(sale: any, info: PaymentInfo): string {
  const saldoPromo = Number(sale?.saldo_precio_promocion) || 0;
  const amount =
    info.cantidadAtrasada > 0
      ? info.cantidadAtrasada
      : info.promoActive
        ? saldoPromo
        : info.saldoNormalConRecargo;
  return (
    `Le recordamos su pago, cuenta con atraso de: $${amount.toFixed(2)}. ` +
    'Atentamente: Mueblería Huastex 👨‍💻😉'
  );
}

/** Open a WhatsApp chat with a prefilled message. Returns false on failure. */
export async function openWhatsAppText(
  phone: string,
  text: string,
): Promise<boolean> {
  const encoded = encodeURIComponent(text);
  try {
    if (await Linking.canOpenURL('whatsapp://send')) {
      await Linking.openURL(`whatsapp://send?phone=${phone}&text=${encoded}`);
      return true;
    }
  } catch {
    // fall through to the universal link
  }
  try {
    await Linking.openURL(`https://wa.me/${phone}?text=${encoded}`);
    return true;
  } catch {
    Alert.alert('Error', 'No se pudo abrir WhatsApp en este dispositivo.');
    return false;
  }
}

/**
 * Share a captured receipt image straight into WhatsApp. Android opens the
 * chat with the given number; iOS opens WhatsApp's own contact picker (its
 * API doesn't accept a preselected number for media).
 */
export async function shareImageToWhatsApp(
  phone: string | null,
  fileUri: string,
): Promise<boolean> {
  try {
    await Share.shareSingle({
      social: Social.Whatsapp,
      url: fileUri,
      type: 'image/png',
      ...(phone ? { whatsAppNumber: phone } : {}),
    });
    return true;
  } catch (err: any) {
    // The user backing out of the share sheet is not an error.
    if (/did not share|cancel/i.test(String(err?.message ?? ''))) return false;
    Alert.alert(
      'Error',
      'No se pudo compartir por WhatsApp. Verifica que esté instalado.',
    );
    return false;
  }
}
