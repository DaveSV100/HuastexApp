// Tests the full PNG → ESC/POS pipeline with a synthetic image, plus the
// ticket text formatters that must match the web's output exactly.
import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import {
  decodePngBase64,
  toGrayResized,
  ditherToMono,
  monoToRasterCommands,
  pngBase64ToEscPos,
  PRINTER_DOTS,
} from '../src/utils/escposImage';
import {
  isoToDDMMYYYY,
  formatTime12h,
  isCreditForm,
  isContadoForm,
} from '../src/utils/ticketFormat';

/** Build a base64 PNG: `width`×`height`, top half black, bottom half white. */
function makeTestPng(width: number, height: number): string {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = y < height / 2 ? 0 : 255;
      rgba[i] = v;
      rgba[i + 1] = v;
      rgba[i + 2] = v;
      rgba[i + 3] = 255;
    }
  }
  const png = UPNG.encode([rgba.buffer], width, height, 0);
  return Buffer.from(png).toString('base64');
}

describe('escposImage pipeline', () => {
  const pngB64 = makeTestPng(768, 200); // 2x the printer width

  it('decodes PNG dimensions and pixels', () => {
    const { width, height, rgba } = decodePngBase64(pngB64);
    expect(width).toBe(768);
    expect(height).toBe(200);
    expect(rgba.length).toBe(768 * 200 * 4);
    expect(rgba[0]).toBe(0); // top-left is black
    const lastPixel = (200 * 768 - 1) * 4;
    expect(rgba[lastPixel]).toBe(255); // bottom-right is white
  });

  it('resizes to printer width preserving aspect ratio', () => {
    const { width, height, rgba } = decodePngBase64(pngB64);
    const gray = toGrayResized(rgba, width, height, PRINTER_DOTS);
    expect(gray.width).toBe(384);
    expect(gray.height).toBe(100); // 200 * (384/768)
    expect(gray.gray[0]).toBeLessThan(10); // black zone
    expect(gray.gray[gray.width * 99]).toBeGreaterThan(245); // white zone
  });

  it('dithers black/white zones without inversion', () => {
    const { width, height, rgba } = decodePngBase64(pngB64);
    const gray = toGrayResized(rgba, width, height, PRINTER_DOTS);
    const mono = ditherToMono(gray);
    expect(mono[0]).toBe(1); // black prints a dot
    expect(mono[gray.width * (gray.height - 1)]).toBe(0); // white prints nothing
  });

  it('emits valid GS v 0 raster structure', () => {
    const data = pngBase64ToEscPos(pngB64);
    // starts with ESC @ (init)
    expect(data[0]).toBe(0x1b);
    expect(data[1]).toBe(0x40);
    // first raster block header
    expect(data[2]).toBe(0x1d); // GS
    expect(data[3]).toBe(0x76); // 'v'
    expect(data[4]).toBe(0x30); // '0'
    expect(data[5]).toBe(0x00); // m = 0
    const bytesPerRow = data[6] | (data[7] << 8);
    expect(bytesPerRow).toBe(384 / 8); // 48 bytes per row
    const rows = data[8] | (data[9] << 8);
    expect(rows).toBe(100); // single band (≤240 rows)
    // total size: init(2) + header(8) + pixels(48*100) + feed(3)
    expect(data.length).toBe(2 + 8 + 48 * 100 + 3);
    // ends with ESC d 4 (feed)
    expect(data[data.length - 3]).toBe(0x1b);
    expect(data[data.length - 2]).toBe(0x64);
    expect(data[data.length - 1]).toBe(0x04);
    // first pixel row: all black → 0xFF bytes
    expect(data[10]).toBe(0xff);
    // last pixel row: all white → 0x00 bytes
    expect(data[2 + 8 + 48 * 100 - 1]).toBe(0x00);
  });

  it('splits tall images into bands of 240 rows', () => {
    const tallPng = makeTestPng(384, 500);
    const data = pngBase64ToEscPos(tallPng);
    // bands of 240 + 240 + 20 rows → three GS v 0 blocks; walk the structure
    const bandRows: number[] = [];
    let p = 2; // skip ESC @
    while (p < data.length - 3) {
      expect(data[p]).toBe(0x1d);
      expect(data[p + 1]).toBe(0x76);
      expect(data[p + 2]).toBe(0x30);
      const bytesPerRow = data[p + 4] | (data[p + 5] << 8);
      const rows = data[p + 6] | (data[p + 7] << 8);
      expect(bytesPerRow).toBe(48);
      bandRows.push(rows);
      p += 8 + bytesPerRow * rows;
    }
    expect(bandRows).toEqual([240, 240, 20]);
    const totalPixelBytes = 48 * 500;
    expect(data.length).toBe(2 + 8 * 3 + totalPixelBytes + 3);
  });
});

describe('ticketFormat (must match the web tickets)', () => {
  it('formats ISO dates as DD-MM-YYYY without timezone shifts', () => {
    expect(isoToDDMMYYYY('2026-06-07T00:00:00.000Z')).toBe('07-06-2026');
    expect(isoToDDMMYYYY('2026-06-08')).toBe('08-06-2026');
    expect(isoToDDMMYYYY('')).toBe('');
    expect(isoToDDMMYYYY(null)).toBe('');
    expect(isoToDDMMYYYY(new Date(2026, 7, 25))).toBe('25-08-2026');
  });

  it('formats time as 12h with a.m./p.m.', () => {
    const s = formatTime12h(new Date(2026, 5, 10, 14, 9).getTime());
    expect(s).toMatch(/0?2:09/);
    expect(s).toMatch(/p\.m\./);
    const am = formatTime12h(new Date(2026, 5, 10, 9, 5).getTime());
    expect(am).toMatch(/a\.m\./);
  });

  it('classifies payment forms like the web regexes', () => {
    expect(isCreditForm('Crédito')).toBe(true);
    expect(isCreditForm('credito')).toBe(true);
    expect(isCreditForm('MSI')).toBe(true);
    expect(isCreditForm('Apartado')).toBe(true);
    expect(isCreditForm('Contado')).toBe(false);
    expect(isContadoForm('Contado')).toBe(true);
    expect(isContadoForm('Crédito')).toBe(false);
  });
});
