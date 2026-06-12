// Validates the pure-JS text-document PDF builder: page structure, WinAnsi
// text content (Spanish accents), signature embedding and pagination.
import { Buffer } from 'buffer';
import {
  jpegDimensions,
  buildTicketPdf,
  buildTicketPdfBase64,
} from '../src/utils/ticketPdf';

/** Tiny valid JPEG skeleton: SOI + SOF0 declaring the given dimensions. */
function makeFakeJpeg(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 (len 4)
    0xff, 0xc0, 0x00, 0x0b, 0x08, // SOF0 (len 11), 8-bit
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00, // 1 component
    0xff, 0xd9, // EOI
  ]);
}

const creditSale = {
  id: 808,
  nombre: 'Miguel Angel Huerta',
  fecha: '2026-06-07T00:00:00.000Z',
  formadepago: 'Crédito',
  sucursal: 'aquismon',
  agentedeventas: 'DSV',
  enganche: '225.00',
  preciopromocion: '2670.00',
  saldo_precio_normal: '3315.00',
  saldo_precio_promocion: '2445.00',
  fechavencimiento: '2026-08-25T00:00:00.000Z',
  aclaraciones: 'Pagos semanales de $225',
  products: [
    {
      title: 'MINISPLIT MIRAGE 1 T R 110V S/F NEX 2024 CHF120T/EHF120T',
      quantity: 1,
      unit_price: 8970,
      serial_number: 'EHF120T3012505403',
    },
  ],
};

const payment = {
  id: 4,
  sale_id: 808,
  fecha: '2026-06-07',
  cantidad: 225,
  saldo_precio_normal: 3315,
  saldo_precio_promocion: 2445,
};

describe('jpegDimensions', () => {
  it('parses JPEG dimensions from the SOF marker', () => {
    const jpeg = makeFakeJpeg(552, 1840);
    expect(jpegDimensions(jpeg)).toEqual({ width: 552, height: 1840 });
  });

  it('rejects non-JPEG data', () => {
    expect(() => jpegDimensions(Uint8Array.from([0x89, 0x50]))).toThrow(
      'Not a JPEG',
    );
  });
});

describe('buildTicketPdf', () => {
  it('builds a structurally valid Letter-size text document', () => {
    const pdf = buildTicketPdf({ sale: creditSale });
    const text = Buffer.from(pdf).toString('latin1');

    expect(text.startsWith('%PDF-1.3\n')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/MediaBox [0 0 612 792]');
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('/BaseFont /Helvetica-Bold');
    expect(text).toContain('/Encoding /WinAnsiEncoding');
    expect(text.endsWith('%%EOF\n')).toBe(true);

    // Real text, not a screenshot: no image without a signature.
    expect(text).not.toContain('/DCTDecode');
    expect(text).toContain('(Comprobante de Venta) Tj');
    expect(text).toContain('(Miguel Angel Huerta) Tj');
    expect(text).toContain('(Folio: 808) Tj');
    expect(text).toContain('(Fecha: 07-06-2026) Tj');
    // "í" must be the WinAnsi 0xED byte.
    expect(text).toContain('(Fecha l\xedmite para liquidar:) Tj');
    expect(text).toContain('($2670.00) Tj');
    // Full-width table header and per-line importe column
    expect(text).toContain('(Importe) Tj');
    expect(text).toContain('($8970.00) Tj');
    // Document metadata
    expect(text).toContain('/Title (Comprobante de Venta 808)');

    // xref offsets must point at the objects they declare.
    const xrefStart = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xrefStart, xrefStart + 4)).toBe('xref');
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n /gm)].map(m =>
      Number(m[1]),
    );
    offsets.forEach((off, i) => {
      expect(text.slice(off, off + String(i + 1).length + 6)).toBe(
        `${i + 1} 0 obj`,
      );
    });
  });

  it('escapes parentheses and encodes accents as WinAnsi bytes', () => {
    const pdf = buildTicketPdf({
      sale: { ...creditSale, nombre: 'Juan (Güero) Pérez' },
    });
    const text = Buffer.from(pdf).toString('latin1');
    expect(text).toContain('(Juan \\(G\xfcero\\) P\xe9rez) Tj');
  });

  it('embeds the signature JPEG only when provided', () => {
    const sig = makeFakeJpeg(256, 120);
    const pdf = buildTicketPdf({
      sale: creditSale,
      signatureJpegBase64: Buffer.from(sig).toString('base64'),
    });
    const text = Buffer.from(pdf).toString('latin1');

    expect(text).toContain('(Firma del cliente) Tj');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text).toContain('/Width 256 /Height 120');
    // signature bytes embedded verbatim
    expect(text).toContain(Buffer.from(sig).toString('latin1'));
  });

  it('hides Saldo Precio Normal for apartado sales and their abonos', () => {
    const apartadoSale = { ...creditSale, formadepago: 'Apartado' };
    const saleText = Buffer.from(
      buildTicketPdf({ sale: apartadoSale }),
    ).toString('latin1');
    expect(saleText).not.toContain('(Saldo Precio Normal:) Tj');
    expect(saleText).toContain('(Saldo Precio Promoci\xf3n:) Tj');

    const abonoText = Buffer.from(
      buildTicketPdf({ sale: apartadoSale, payment }),
    ).toString('latin1');
    expect(abonoText).not.toContain('(Saldo Precio Normal:) Tj');
    expect(abonoText).toContain('(Saldo Precio Promoci\xf3n:) Tj');
  });

  it('renders abono wording for payments', () => {
    const pdf = buildTicketPdf({ sale: creditSale, payment });
    const text = Buffer.from(pdf).toString('latin1');
    expect(text).toContain('(Recibo de Abono) Tj');
    expect(text).toContain('(Cantidad pagada:) Tj');
    expect(text).toContain('($225.00) Tj');
    expect(text).toContain('(WhatsApp: 482 108 8377) Tj');
    expect(text).not.toContain('(Total:) Tj');
  });

  it('paginates long product lists onto extra pages', () => {
    const sale = {
      ...creditSale,
      products: Array.from({ length: 80 }, (_, i) => ({
        title: `Producto número ${i + 1}`,
        quantity: 1,
        unit_price: 100,
      })),
    };
    const pdf = buildTicketPdf({ sale });
    const text = Buffer.from(pdf).toString('latin1');
    const count = Number(text.match(/\/Count (\d+)/)![1]);
    expect(count).toBeGreaterThan(1);
    expect((text.match(/\/Type \/Page /g) || []).length).toBe(count);
  });

  it('round-trips through base64', () => {
    const b64 = buildTicketPdfBase64({ sale: creditSale });
    const pdf = Buffer.from(b64, 'base64').toString('latin1');
    expect(pdf.startsWith('%PDF-1.3')).toBe(true);
    expect(pdf).toContain('(Comprobante de Venta) Tj');
  });
});
