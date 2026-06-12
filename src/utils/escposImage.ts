/* eslint-disable no-bitwise */
// src/utils/escposImage.ts
// Converts a captured ticket PNG (base64) into ESC/POS raster bytes for a
// 58mm thermal printer (384 dots per line). Pure JS so it can run on-device
// and be unit-tested: decode PNG → resize to printer width → grayscale →
// Floyd-Steinberg dither → GS v 0 raster bands.
import UPNG from 'upng-js';
import { Buffer } from 'buffer';

export const PRINTER_DOTS = 384; // 58mm printhead width

// Printers have a small RAM buffer; sending the image as one giant GS v 0
// block overflows some models, so it is split into bands this tall.
const BAND_ROWS = 240;

export interface MonoImage {
  width: number;
  height: number;
  /** one byte per pixel, 0 = white … 255 = black-ness applied later */
  gray: Uint8Array;
}

export function decodePngBase64(pngBase64: string): {
  width: number;
  height: number;
  rgba: Uint8Array;
} {
  const buf = Buffer.from(pngBase64, 'base64');
  const img = UPNG.decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);
  return { width: img.width, height: img.height, rgba };
}

// Box-resample RGBA to the printer width, flatten transparency onto white,
// and convert to a single luminance byte per pixel.
export function toGrayResized(
  rgba: Uint8Array,
  width: number,
  height: number,
  targetWidth: number = PRINTER_DOTS,
): MonoImage {
  const targetHeight = Math.max(1, Math.round((height * targetWidth) / width));
  const gray = new Uint8Array(targetWidth * targetHeight);
  const xRatio = width / targetWidth;
  const yRatio = height / targetHeight;

  for (let ty = 0; ty < targetHeight; ty++) {
    const y0 = Math.floor(ty * yRatio);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.floor((ty + 1) * yRatio)));
    for (let tx = 0; tx < targetWidth; tx++) {
      const x0 = Math.floor(tx * xRatio);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.floor((tx + 1) * xRatio)));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          const a = rgba[i + 3] / 255;
          // composite on white background
          const r = rgba[i] * a + 255 * (1 - a);
          const g = rgba[i + 1] * a + 255 * (1 - a);
          const b = rgba[i + 2] * a + 255 * (1 - a);
          sum += 0.299 * r + 0.587 * g + 0.114 * b;
          n++;
        }
      }
      gray[ty * targetWidth + tx] = sum / n;
    }
  }
  return { width: targetWidth, height: targetHeight, gray };
}

// Floyd-Steinberg dithering → 1 bit per pixel (true = print a black dot).
// Dithering keeps the logo's blue gradient printable instead of a black blob.
export function ditherToMono({ width, height, gray }: MonoImage): Uint8Array {
  const lum = Float32Array.from(gray);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = lum[i];
      const isBlack = old < 128;
      out[i] = isBlack ? 1 : 0;
      const err = old - (isBlack ? 0 : 255);
      if (x + 1 < width) lum[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) lum[i + width - 1] += (err * 3) / 16;
        lum[i + width] += (err * 5) / 16;
        if (x + 1 < width) lum[i + width + 1] += (err * 1) / 16;
      }
    }
  }
  return out;
}

// Pack 1-bit pixels into ESC/POS "GS v 0" raster blocks, in bands.
export function monoToRasterCommands(
  mono: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const bytesPerRow = Math.ceil(width / 8);
  const chunks: number[] = [];

  // ESC @  — reset printer state
  chunks.push(0x1b, 0x40);

  for (let bandTop = 0; bandTop < height; bandTop += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, height - bandTop);
    // GS v 0 m=0 (normal density), xL xH = bytes/row, yL yH = rows
    chunks.push(
      0x1d, 0x76, 0x30, 0x00,
      bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff,
    );
    for (let y = bandTop; y < bandTop + rows; y++) {
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x < width && mono[y * width + x]) {
            byte |= 0x80 >> bit;
          }
        }
        chunks.push(byte);
      }
    }
  }

  // ESC d 4 — feed 4 lines so the ticket clears the tear bar
  chunks.push(0x1b, 0x64, 0x04);
  return Uint8Array.from(chunks);
}

/** Full pipeline: base64 PNG → ESC/POS bytes ready to stream to the printer. */
export function pngBase64ToEscPos(
  pngBase64: string,
  targetWidth: number = PRINTER_DOTS,
): Uint8Array {
  const { width, height, rgba } = decodePngBase64(pngBase64);
  const grayImg = toGrayResized(rgba, width, height, targetWidth);
  const mono = ditherToMono(grayImg);
  return monoToRasterCommands(mono, grayImg.width, grayImg.height);
}
