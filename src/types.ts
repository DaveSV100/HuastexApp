// src/types.ts
// Shared shapes for the e-commerce side of the app.

export type Product = {
  id: number;
  title: string;
  description?: string | null;
  price: string; // backend returns a decimal string, e.g. "8900.00"
  image_url?: string | null;
  category?: string | null;
  model?: string | null;
  serial_number?: string | null;
};

export type CartItem = {
  id: number;
  title: string;
  price: string;
  image_url?: string | null;
  category?: string | null;
  quantity: number;
};
