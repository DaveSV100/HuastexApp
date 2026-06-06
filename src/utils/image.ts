// src/utils/image.ts
// Product images come back as a relative path (e.g. "/uploads/foo.jpg").
// The API host serves them, so prepend it.
import { API_BASE } from '../api';

export function productImageUrl(imageUrl?: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}
