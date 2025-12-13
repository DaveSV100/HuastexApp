// src/utils/jwt.js
import { Buffer } from 'buffer';

export function parseJwt(token) {
  try {
    // 1) grab the payload segment
    const base64Url = token.split('.')[1];
    // 2) Base64URL → Base64
    const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // 3) decode from Base64 to UTF-8
    const json      = Buffer.from(base64, 'base64').toString('utf8');
    // 4) parse JSON
    return JSON.parse(json);
  } catch (e) {
    console.error('parseJwt failed:', e);
    return null;
  }
}