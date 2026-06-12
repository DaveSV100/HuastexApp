// src/utils/ticketPdf.ts
// Pure-JS generator for the shareable ticket PDF. Instead of embedding a
// screenshot of the ticket, it lays the receipt out as a real document:
// US-Letter page, selectable Helvetica text (WinAnsiEncoding covers the
// Spanish accents) and automatic page breaks. The customer's signature is
// the only raster element — it arrives as a JPEG capture and is embedded
// via /DCTDecode. Still no native PDF library needed.
import { Buffer } from 'buffer';
import { formatTime12h, deriveTicketModel } from './ticketFormat';

const PAGE_W = 612; // US Letter (carta), in points
const PAGE_H = 792;
const MARGIN = 56;
const RIGHT = PAGE_W - MARGIN;

/** Read width/height from a JPEG's SOF marker. */
export function jpegDimensions(jpeg: Uint8Array): {
  width: number;
  height: number;
} {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error('Not a JPEG');
  }
  let i = 2;
  while (i < jpeg.length - 9) {
    if (jpeg[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = jpeg[i + 1];
    // SOF0..SOF15 hold dimensions (skipping DHT/DAC/RST markers C4, C8, CC)
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      const height = (jpeg[i + 5] << 8) | jpeg[i + 6];
      const width = (jpeg[i + 7] << 8) | jpeg[i + 8];
      return { width, height };
    }
    const len = (jpeg[i + 2] << 8) | jpeg[i + 3];
    i += 2 + len;
  }
  throw new Error('JPEG dimensions not found');
}

// Standard Adobe AFM advance widths (1/1000 em) for chars 32..126, used to
// center, right-align and word-wrap without measuring on a canvas.
// prettier-ignore
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
// prettier-ignore
const HELV_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

function stripAccents(s: string): string {
  try {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    return s;
  }
}

/** Rendered width in points (accented chars measured as their base letter). */
function textWidth(text: string, size: number, bold = false): number {
  const table = bold ? HELV_BOLD : HELV;
  let units = 0;
  for (const ch of stripAccents(String(text))) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? table[code - 32] : 556;
  }
  return (units * size) / 1000;
}

// WinAnsi byte for the few non-latin1 chars the tickets contain (e.g. "—").
const CP1252: Record<number, number> = {
  0x20ac: 0x80, // €
  0x2026: 0x85, // …
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2013: 0x96, // –
  0x2014: 0x97, // —
};

/** Escape + WinAnsi-encode a JS string into a PDF literal string. */
function pdfString(text: string): string {
  let out = '';
  for (const ch of String(text)) {
    let code = ch.codePointAt(0) ?? 0x3f;
    if (code > 0xff) code = CP1252[code] ?? 0x3f; // unknown → '?'
    if (code < 0x20) code = 0x20; // control chars → space
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += '\\';
    out += String.fromCharCode(code);
  }
  return `(${out})`;
}

function wrapText(
  text: string,
  size: number,
  bold: boolean,
  maxWidth: number,
): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || textWidth(candidate, size, bold) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

const num = (n: number) => String(Math.round(n * 100) / 100);

interface TextRun {
  x: number;
  text: string;
  size: number;
  bold?: boolean;
  /** 0 = black (default), 1 = white. */
  gray?: number;
}

/** Minimal multi-page PDF: text rows, horizontal rules and JPEG images. */
class PdfDoc {
  private pages: string[][] = [];
  private ops: string[] = [];
  private images: { width: number; height: number; data: Uint8Array }[] = [];
  private y = 0;

  constructor() {
    this.addPage();
  }

  private addPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = PAGE_H - MARGIN;
  }

  /** Page-break when fewer than `height` points remain. */
  private ensure(height: number) {
    if (this.y - height < MARGIN) this.addPage();
  }

  space(h: number) {
    this.y -= h;
  }

  /** Baseline cursor (distance from page bottom). */
  get cursorY(): number {
    return this.y;
  }

  set cursorY(v: number) {
    this.y = v;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /**
   * One baseline holding one or more text runs; advances the cursor.
   * `fill` paints a full-width band behind the line (table headers).
   */
  row(runs: TextRun[], lineHeight: number, fill?: number) {
    this.ensure(lineHeight);
    this.y -= lineHeight;
    if (fill != null) {
      this.ops.push(
        `${num(fill)} g ${num(MARGIN)} ${num(this.y - 5)} ` +
          `${num(RIGHT - MARGIN)} ${num(lineHeight + 7)} re f`,
      );
    }
    for (const r of runs) {
      this.ops.push(
        `${num(r.gray ?? 0)} g BT /${r.bold ? 'F2' : 'F1'} ${num(r.size)} Tf ` +
          `${num(r.x)} ${num(this.y)} Td ${pdfString(r.text)} Tj ET`,
      );
    }
  }

  text(
    str: string,
    size: number,
    opts: { bold?: boolean; gray?: number; x?: number } = {},
  ) {
    this.row(
      [{ x: opts.x ?? MARGIN, text: str, size, bold: opts.bold, gray: opts.gray }],
      size * 1.5,
    );
  }

  centered(str: string, size: number, opts: { bold?: boolean; gray?: number } = {}) {
    const x = (PAGE_W - textWidth(str, size, opts.bold)) / 2;
    this.row([{ x, text: str, size, bold: opts.bold, gray: opts.gray }], size * 1.5);
  }

  /** Label + value pushed against the right margin (totals block). */
  rightLabelValue(label: string, value: string, size = 11, valueBold = false) {
    const valueW = textWidth(value, size, valueBold);
    const labelW = textWidth(label, size, true);
    this.row(
      [
        { x: RIGHT - valueW - 10 - labelW, text: label, size, bold: true },
        { x: RIGHT - valueW, text: value, size, bold: valueBold },
      ],
      size * 1.7,
    );
  }

  rule(gray = 0.75, lineWidth = 0.7) {
    this.ensure(12);
    this.y -= 7;
    this.ops.push(
      `${num(gray)} G ${num(lineWidth)} w ${num(MARGIN)} ${num(this.y)} m ` +
        `${num(RIGHT)} ${num(this.y)} l S`,
    );
    this.y -= 5;
  }

  /** Word-wraps `str` to maxWidth points and writes each line. */
  wrapped(
    str: string,
    size: number,
    maxWidth: number,
    opts: { bold?: boolean; gray?: number; x?: number } = {},
  ) {
    for (const line of wrapText(str, size, Boolean(opts.bold), maxWidth)) {
      this.text(line, size, opts);
    }
  }

  /** Embed a JPEG scaled to drawWidth points at the given left edge. */
  jpegImage(jpeg: Uint8Array, drawWidth: number, x = MARGIN) {
    const { width, height } = jpegDimensions(jpeg);
    const drawHeight = (height * drawWidth) / width;
    this.ensure(drawHeight + 6);
    this.y -= drawHeight;
    this.images.push({ width, height, data: jpeg });
    this.ops.push(
      `q ${num(drawWidth)} 0 0 ${num(drawHeight)} ${num(x)} ` +
        `${num(this.y)} cm /Im${this.images.length} Do Q`,
    );
    this.y -= 6;
  }

  /** One text run at an absolute position on the current page. */
  textAt(
    str: string,
    size: number,
    x: number,
    baselineY: number,
    opts: { bold?: boolean; gray?: number } = {},
  ) {
    this.ops.push(
      `${num(opts.gray ?? 0)} g BT /${opts.bold ? 'F2' : 'F1'} ` +
        `${num(size)} Tf ${num(x)} ${num(baselineY)} Td ` +
        `${pdfString(str)} Tj ET`,
    );
  }

  /**
   * Draw a JPEG with its top edge at `top` on the current page (no
   * pagination — caller checks the room). Returns the bottom edge.
   */
  jpegImageAt(
    jpeg: Uint8Array,
    drawWidth: number,
    x: number,
    top: number,
  ): number {
    const { width, height } = jpegDimensions(jpeg);
    const drawHeight = (height * drawWidth) / width;
    const bottom = top - drawHeight;
    this.images.push({ width, height, data: jpeg });
    this.ops.push(
      `q ${num(drawWidth)} 0 0 ${num(drawHeight)} ${num(x)} ` +
        `${num(bottom)} cm /Im${this.images.length} Do Q`,
    );
    return bottom;
  }

  /** Serialize catalog, fonts, images and pages into the final PDF bytes. */
  build(title?: string): Uint8Array {
    const objects: Buffer[] = [];
    const addObj = (id: number, body: string, stream?: Uint8Array) => {
      const head = `${id} 0 obj\n${body}\n`;
      if (stream) {
        objects.push(
          Buffer.concat([
            Buffer.from(head + 'stream\n', 'latin1'),
            Buffer.from(stream),
            Buffer.from('\nendstream\nendobj\n', 'latin1'),
          ]),
        );
      } else {
        objects.push(Buffer.from(head + 'endobj\n', 'latin1'));
      }
    };

    const firstPageId = 5 + this.images.length;
    const kids = this.pages
      .map((_, i) => `${firstPageId + i * 2} 0 R`)
      .join(' ');

    let resources =
      '/ProcSet [/PDF /Text /ImageC] /Font << /F1 3 0 R /F2 4 0 R >>';
    if (this.images.length) {
      const xobjects = this.images
        .map((_, i) => `/Im${i + 1} ${5 + i} 0 R`)
        .join(' ');
      resources += ` /XObject << ${xobjects} >>`;
    }

    addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    addObj(2, `<< /Type /Pages /Kids [${kids}] /Count ${this.pages.length} >>`);
    addObj(
      3,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica ' +
        '/Encoding /WinAnsiEncoding >>',
    );
    addObj(
      4,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold ' +
        '/Encoding /WinAnsiEncoding >>',
    );
    this.images.forEach((im, i) => {
      addObj(
        5 + i,
        `<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} ` +
          '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ' +
          `/Length ${im.data.length} >>`,
        im.data,
      );
    });
    this.pages.forEach((ops, i) => {
      const pageId = firstPageId + i * 2;
      const content = ops.join('\n') + '\n';
      addObj(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
          `/Resources << ${resources} >> /Contents ${pageId + 1} 0 R >>`,
      );
      addObj(
        pageId + 1,
        `<< /Length ${content.length} >>`,
        Buffer.from(content, 'latin1'),
      );
    });
    const infoId = firstPageId + this.pages.length * 2;
    addObj(
      infoId,
      `<< /Title ${pdfString(title || 'Recibo huastex')} ` +
        '/Producer (HuastexApp) >>',
    );

    // The second comment line marks the file as binary (PDF spec convention)
    // so nothing downstream re-encodes it as text.
    const header = Buffer.from('%PDF-1.3\n%\xe2\xe3\xcf\xd3\n', 'latin1');
    const offsets: number[] = [];
    let position = header.length;
    for (const obj of objects) {
      offsets.push(position);
      position += obj.length;
    }

    const xrefStart = position;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      xref += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    const trailer =
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ` +
      `/Info ${infoId} 0 R >>\n` +
      `startxref\n${xrefStart}\n%%EOF\n`;

    return Uint8Array.from(
      Buffer.concat([header, ...objects, Buffer.from(xref + trailer, 'latin1')]),
    );
  }
}

export interface TicketPdfInput {
  sale: any;
  /** When present the document is an abono (payment) receipt. */
  payment?: any | null;
  /** JPEG capture (base64) of the signature box, when the customer signed. */
  signatureJpegBase64?: string | null;
}

/**
 * Lay the sale/abono receipt out as a Letter-size text document: invoice-style
 * header band (brand left, folio/date right), a two-column info grid and a
 * full-width product table, so the page width is actually used.
 */
export function buildTicketPdf({
  sale,
  payment,
  signatureJpegBase64,
}: TicketPdfInput): Uint8Array {
  const m = deriveTicketModel(sale, payment);
  const doc = new PdfDoc();
  const title = m.isPayment ? 'Recibo de Abono' : 'Comprobante de Venta';

  // ── Header band: brand on the left, document data on the right ──
  doc.space(4);
  doc.row(
    [
      { x: MARGIN, text: 'huastex', size: 30, bold: true },
      {
        x: RIGHT - textWidth(title, 17, true),
        text: title,
        size: 17,
        bold: true,
      },
    ],
    30,
  );
  const folioLine = `Folio: ${m.folio}`;
  doc.row(
    [
      { x: MARGIN, text: 'Acondiciona tu espacio', size: 11, gray: 0.4 },
      { x: RIGHT - textWidth(folioLine, 11), text: folioLine, size: 11 },
    ],
    17,
  );
  const fechaLine = `Fecha: ${m.ticketDate}`;
  doc.row(
    [{ x: RIGHT - textWidth(fechaLine, 11), text: fechaLine, size: 11 }],
    15,
  );
  const horaLine = `Hora: ${formatTime12h()}`;
  doc.row(
    [{ x: RIGHT - textWidth(horaLine, 11), text: horaLine, size: 11 }],
    15,
  );
  doc.space(8);
  doc.rule(0.2, 1.4);
  doc.space(12);

  // ── Customer / sale info, two columns across the page ──
  const colB = MARGIN + (RIGHT - MARGIN) / 2 + 8;
  const info: Array<[string, string]> = [['CLIENTE', m.clientName]];
  if (sale?.sucursal) {
    info.push(['SUCURSAL', String(sale.sucursal)]);
  }
  if (sale?.agentedeventas) {
    info.push(['AGENTE DE VENTAS', String(sale.agentedeventas)]);
  }
  if (sale?.formadepago) {
    info.push(['FORMA DE PAGO', String(sale.formadepago)]);
  }
  for (let i = 0; i < info.length; i += 2) {
    const pair = info.slice(i, i + 2);
    doc.row(
      pair.map(([label], j) => ({
        x: j === 0 ? MARGIN : colB,
        text: label,
        size: 9,
        bold: true,
        gray: 0.45,
      })),
      13,
    );
    doc.row(
      pair.map(([, value], j) => ({
        x: j === 0 ? MARGIN : colB,
        text: value,
        size: 12.5,
      })),
      18,
    );
    doc.space(8);
  }

  // ── Products table across the full width ──
  doc.space(6);
  doc.text('Productos', 14, { bold: true });
  doc.space(6);
  const tableW = RIGHT - MARGIN;
  const cantRight = MARGIN + tableW * 0.66;
  const unitRight = MARGIN + tableW * 0.83;
  const nameWidth = tableW * 0.66 - 70;
  doc.row(
    [
      { x: MARGIN + 4, text: 'Producto', size: 10, bold: true, gray: 0.25 },
      {
        x: cantRight - textWidth('Cant.', 10, true),
        text: 'Cant.',
        size: 10,
        bold: true,
        gray: 0.25,
      },
      {
        x: unitRight - textWidth('Precio unit.', 10, true),
        text: 'Precio unit.',
        size: 10,
        bold: true,
        gray: 0.25,
      },
      {
        x: RIGHT - 4 - textWidth('Importe', 10, true),
        text: 'Importe',
        size: 10,
        bold: true,
        gray: 0.25,
      },
    ],
    16,
    0.93,
  );
  doc.space(5);
  if (m.products.length) {
    for (const p of m.products) {
      const name = p.title || p.producto || 'Sin nombre';
      const qty = String(p.quantity ?? 1);
      const unitRaw = p.unit_price ?? p.price;
      const unit = `$${unitRaw ?? 'N/A'}`;
      const importeNum = Number(p.quantity ?? 1) * Number(unitRaw);
      const importe = Number.isFinite(importeNum)
        ? `$${importeNum.toFixed(2)}`
        : '-';
      const [firstLine, ...restLines] = wrapText(name, 11.5, false, nameWidth);
      doc.row(
        [
          { x: MARGIN + 4, text: firstLine, size: 11.5 },
          { x: cantRight - textWidth(qty, 11.5), text: qty, size: 11.5 },
          { x: unitRight - textWidth(unit, 11.5), text: unit, size: 11.5 },
          { x: RIGHT - 4 - textWidth(importe, 11.5), text: importe, size: 11.5 },
        ],
        18,
      );
      for (const line of restLines) {
        doc.text(line, 11.5, { x: MARGIN + 4 });
      }
      if (p.serial_number) {
        doc.text(`Serie: ${p.serial_number}`, 9.5, {
          gray: 0.4,
          x: MARGIN + 14,
        });
      }
      doc.rule(0.9, 0.5);
    }
  } else {
    doc.text('Sin productos', 11.5, { x: MARGIN + 4 });
    doc.rule(0.9, 0.5);
  }

  // ── Totals, right-aligned (same fields/wording as the thermal ticket) ──
  doc.space(8);
  if (m.isPayment) {
    doc.rightLabelValue('Cantidad pagada:', `$${m.paymentAmount}`, 15, true);
    doc.space(2);
    doc.rightLabelValue('Fecha límite para liquidar:', m.dueDate, 11.5);
    if (!m.apartado) {
      doc.rightLabelValue('Saldo Precio Normal:', m.saldoNormal || '-', 11.5);
    }
    doc.rightLabelValue('Saldo Precio Promoción:', m.saldoPromo || '-', 11.5);
  } else {
    doc.rightLabelValue('Total:', `$${m.total}`, 15, true);
    doc.space(2);
    if (!m.contado) {
      doc.rightLabelValue('Enganche:', `$${m.formattedEnganche}`, 11.5);
    }
    if (m.credit) {
      doc.rightLabelValue('Fecha límite para liquidar:', m.dueDate, 11.5);
      if (!m.apartado) {
        doc.rightLabelValue('Saldo Precio Normal:', m.saldoNormal || '-', 11.5);
      }
      doc.rightLabelValue('Saldo Precio Promoción:', m.saldoPromo || '-', 11.5);
    }
  }
  doc.space(10);
  doc.rule();
  doc.space(6);

  // ── Notas + contact on the left; signature on the right half ──
  const zoneTop = doc.cursorY;
  const zonePage = doc.pageCount;
  if (sale?.aclaraciones) {
    doc.text('NOTAS', 9, { bold: true, gray: 0.45 });
    doc.wrapped(String(sale.aclaraciones), 11, colB - MARGIN - 16, {
      gray: 0.15,
    });
    doc.space(10);
  }
  doc.text(
    m.isPayment ? 'WhatsApp: 482 108 8377' : 'Número de cel: 482 108 8377',
    10,
    { gray: 0.35 },
  );
  doc.text('Correo: contacto@huastex.com', 10, { gray: 0.35 });

  // ── Signature — only when the customer actually signed ──
  if (signatureJpegBase64) {
    try {
      const jpeg = Uint8Array.from(Buffer.from(signatureJpegBase64, 'base64'));
      const sigW = 200;
      const { width, height } = jpegDimensions(jpeg);
      const sigH = (height * sigW) / width;
      // Side by side with the notes/contact block when it fits on this page;
      // otherwise flow it below (paginating like any other block).
      if (zonePage === doc.pageCount && zoneTop - (18 + sigH) > MARGIN) {
        const captionBase = zoneTop - 12;
        doc.textAt('Firma del cliente', 11, colB, captionBase, { bold: true });
        const bottom = doc.jpegImageAt(jpeg, sigW, colB, captionBase - 5);
        doc.cursorY = Math.min(doc.cursorY, bottom - 6);
      } else {
        doc.space(16);
        doc.text('Firma del cliente', 11, { bold: true });
        doc.space(3);
        doc.jpegImage(jpeg, sigW);
      }
    } catch (err) {
      // A bad capture must not block sharing the document.
      console.warn('ticketPdf: skipping signature image', err);
    }
  }

  // ── Footer ──
  doc.space(20);
  if (m.isPayment) {
    doc.centered('huastex — Acondiciona tu espacio', 10, { gray: 0.4 });
  }
  doc.centered('Compra en huastex.com', 10, { gray: 0.4 });

  return doc.build(`${title} ${m.folio}`);
}

/** Same document, base64-encoded for Share.open's data-URI API. */
export function buildTicketPdfBase64(input: TicketPdfInput): string {
  return Buffer.from(buildTicketPdf(input)).toString('base64');
}
