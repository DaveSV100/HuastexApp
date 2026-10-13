// src/utils/simplePdf.ts
// Tiny dependency-free PDF writer for the backup downloads: renders plain
// monospaced text lines across as many Letter pages as needed and returns the
// document as base64. (ticketPdf.ts is specialized for 58mm tickets; this one
// is for full-page data dumps.)
import { Buffer } from 'buffer';

const PAGE_W = 612; // Letter, 72dpi points
const PAGE_H = 792;
const MARGIN = 36;
const FONT_SIZE = 8;
const LINE_H = 10;
const TITLE_SIZE = 12;
const LINES_PER_PAGE = Math.floor((PAGE_H - 2 * MARGIN - 20) / LINE_H);
// Courier 8pt ≈ 4.8pt/char → what fits between the margins.
export const PDF_LINE_CHARS = Math.floor((PAGE_W - 2 * MARGIN) / (FONT_SIZE * 0.6));

/** Escape PDF string syntax and force Latin-1 (WinAnsi) bytes. */
const pdfEscape = (text: string): string => {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0) || 63;
    if (ch === '(' || ch === ')' || ch === '\\') {
      out += '\\' + ch;
    } else if (code >= 32 && code <= 255) {
      out += ch;
    } else {
      out += '?';
    }
  }
  return out;
};

/** Hard-wrap a long line into chunks that fit the page width. */
export const wrapLine = (line: string, width: number = PDF_LINE_CHARS): string[] => {
  const text = String(line ?? '');
  if (text.length <= width) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += width) {
    chunks.push(text.slice(i, i + width));
  }
  return chunks;
};

/**
 * Build a multi-page text PDF: `title` on top of the first page, then every
 * line of `lines` (pre-wrapped by the caller or auto-wrapped here).
 */
export function textToPdfBase64(title: string, lines: string[]): string {
  const wrapped: string[] = [];
  for (const line of lines) {
    wrapped.push(...wrapLine(line));
  }

  const pages: string[][] = [];
  for (let i = 0; i < Math.max(wrapped.length, 1); i += LINES_PER_PAGE) {
    pages.push(wrapped.slice(i, i + LINES_PER_PAGE));
  }

  // Objects: 1 catalog, 2 pages tree, 3 font, then per page: page + stream.
  const objects: string[] = [];
  const pageObjNums: number[] = [];
  let nextObj = 4;

  const pageRefs = pages.map(() => {
    const pageNum = nextObj;
    pageObjNums.push(pageNum);
    nextObj += 2; // page obj + content obj
    return `${pageNum} 0 R`;
  });

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>\nendobj\n`,
  );
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n',
  );

  pages.forEach((pageLines, pageIndex) => {
    const pageNum = pageObjNums[pageIndex];
    const contentNum = pageNum + 1;

    let text = 'BT\n';
    let y = PAGE_H - MARGIN;
    if (pageIndex === 0) {
      text += `/F1 ${TITLE_SIZE} Tf\n1 0 0 1 ${MARGIN} ${y} Tm\n(${pdfEscape(title)}) Tj\n`;
      y -= 20;
    }
    text += `/F1 ${FONT_SIZE} Tf\n1 0 0 1 ${MARGIN} ${y} Tm\n${LINE_H} TL\n`;
    for (const line of pageLines) {
      text += `(${pdfEscape(line)}) Tj\nT*\n`;
    }
    text += 'ET\n';

    const streamBytes = Buffer.byteLength(text, 'latin1');
    objects.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`,
    );
    objects.push(
      `${contentNum} 0 obj\n<< /Length ${streamBytes} >>\nstream\n${text}endstream\nendobj\n`,
    );
  });

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += obj;
  }

  const xrefStart = Buffer.byteLength(body, 'latin1');
  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  body +=
    xref +
    `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(body, 'latin1').toString('base64');
}
