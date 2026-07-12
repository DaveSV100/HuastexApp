// WhatsApp helpers: MX phone normalization, the owner's reminder wording
// (amount = atraso, falling back to the outstanding saldo), and that the
// share/link plumbing targets the right number.
import { Linking } from 'react-native';
import Share from 'react-native-share';
import {
  normalizePhoneMx,
  buildPaymentReminder,
  openWhatsAppText,
  shareImageToWhatsApp,
} from '../src/utils/whatsapp';
import { getPaymentInfo } from '../src/utils/paymentStatus';

const NOW = new Date('2026-07-06T12:00:00Z');

describe('normalizePhoneMx', () => {
  it('handles the shapes stored on sales', () => {
    expect(normalizePhoneMx('5652793349')).toBe('525652793349');
    expect(normalizePhoneMx('565 279 3349')).toBe('525652793349');
    expect(normalizePhoneMx('+52 565 279 3349')).toBe('525652793349');
    expect(normalizePhoneMx('5215652793349')).toBe('525652793349'); // legacy 521
    expect(normalizePhoneMx('12345')).toBeNull();
    expect(normalizePhoneMx('')).toBeNull();
    expect(normalizePhoneMx(null)).toBeNull();
  });
});

describe('buildPaymentReminder', () => {
  const baseSale = {
    formadepago: 'Crédito',
    preciopromocion: '10000.00',
    enganche: '2000.00',
    saldo_precio_promocion: '8000.00',
    saldo_precio_normal: '9200.00',
    fecha: '2026-01-05T00:00:00.000Z',
    fechavencimiento: '2026-10-12T00:00:00.000Z',
    plazo: { value: '40', unit: 'weeks' },
    payment_frequency: 'Semanal',
  };

  it("uses the owner's wording with the atraso amount", () => {
    // Paid only the enganche → 26 weeks × $200 = $5200 behind.
    const msg = buildPaymentReminder(baseSale, getPaymentInfo(baseSale, NOW));
    expect(msg).toBe(
      'Le recordamos su pago, cuenta con atraso de: $5200.00. ' +
        'Atentamente: Mueblería Huastex 👨‍💻😉',
    );
  });

  it('falls back to the promo saldo when nothing is atrasado yet', () => {
    const sale = { ...baseSale, saldo_precio_promocion: '2800.00' };
    const msg = buildPaymentReminder(sale, getPaymentInfo(sale, NOW));
    expect(msg).toContain('$2800.00');
  });

  it('uses the whole outstanding saldo for overdue "Al terminar" sales', () => {
    const sale = {
      ...baseSale,
      payment_frequency: 'Al terminar',
      fechavencimiento: '2026-03-01T00:00:00.000Z', // months past due
      saldo_precio_promocion: '1500.00',
    };
    const info = getPaymentInfo(sale, NOW);
    expect(info.status).toBe('vencida');
    const msg = buildPaymentReminder(sale, info);
    expect(msg).toContain('$1500.00');
  });
});

describe('openWhatsAppText', () => {
  it('opens the whatsapp:// chat with the encoded message', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    await openWhatsAppText('525652793349', 'Hola ¿qué tal?');
    expect(openSpy).toHaveBeenCalledWith(
      `whatsapp://send?phone=525652793349&text=${encodeURIComponent('Hola ¿qué tal?')}`,
    );
    jest.restoreAllMocks();
  });

  it('falls back to wa.me when the app scheme is unavailable', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    await openWhatsAppText('525652793349', 'hola');
    expect(openSpy).toHaveBeenCalledWith('https://wa.me/525652793349?text=hola');
    jest.restoreAllMocks();
  });
});

describe('shareImageToWhatsApp', () => {
  it('targets WhatsApp with the number and file', async () => {
    const mockedShare = Share as jest.Mocked<typeof Share>;
    (mockedShare.shareSingle as jest.Mock).mockResolvedValue({} as any);
    await shareImageToWhatsApp('525652793349', 'file:///tmp/recibo.png');
    expect(mockedShare.shareSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        social: 'whatsapp',
        url: 'file:///tmp/recibo.png',
        whatsAppNumber: '525652793349',
      }),
    );
  });
});
