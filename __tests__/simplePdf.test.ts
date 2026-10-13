import { Buffer } from 'buffer';
import { textToPdfBase64, wrapLine, PDF_LINE_CHARS } from '../src/utils/simplePdf';

describe('wrapLine', () => {
  it('keeps short lines intact', () => {
    expect(wrapLine('hola')).toEqual(['hola']);
  });

  it('splits long lines at the page width', () => {
    const long = 'x'.repeat(PDF_LINE_CHARS * 2 + 5);
    const chunks = wrapLine(long);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(PDF_LINE_CHARS);
    expect(chunks.join('')).toBe(long);
  });
});

describe('textToPdfBase64', () => {
  const decode = (b64: string) => Buffer.from(b64, 'base64').toString('latin1');

  it('produces a structurally valid PDF', () => {
    const pdf = decode(textToPdfBase64('Título', ['línea 1', 'línea 2']));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('%%EOF');
    expect(pdf).toContain('/Type /Catalog');
    expect(pdf).toContain('(l\xEDnea 1) Tj');
  });

  it('paginates long documents', () => {
    const lines = Array.from({ length: 300 }, (_, i) => `registro ${i}`);
    const pdf = decode(textToPdfBase64('Backup', lines));
    const pageCount = (pdf.match(/\/Type \/Page[^s]/g) || []).length;
    expect(pageCount).toBeGreaterThan(2);
    expect(pdf).toContain(`/Count ${pageCount}`);
  });

  it('escapes PDF special characters', () => {
    const pdf = decode(textToPdfBase64('t', ['a(b)c\\d']));
    expect(pdf).toContain('(a\\(b\\)c\\\\d) Tj');
  });
});
