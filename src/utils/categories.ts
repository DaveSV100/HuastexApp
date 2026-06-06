// src/utils/categories.ts
// Canonical category list for the 7-tile landing and /category/:slug filtering.
// DB category values are inconsistent (e.g. "Computo", "Lavadoras"), so always
// normalize a product's raw category before comparing it against a slug.

export type Category = { slug: string; label: string };

export const CATEGORIES: Category[] = [
  { slug: 'electronica', label: 'Electrónica' },
  { slug: 'linea-blanca', label: 'Línea Blanca' },
  { slug: 'bicicletas', label: 'Bicicletas' },
  { slug: 'muebles', label: 'Muebles' },
  { slug: 'colchones', label: 'Colchones' },
  { slug: 'motocicletas', label: 'Motocicletas' },
  { slug: 'aire-acondicionado', label: 'Aire Acondicionado' },
];

// Maps legacy / inconsistent DB values onto canonical slugs.
const ALIASES: Record<string, string> = {
  computo: 'electronica',
  electronics: 'electronica',
  electronica: 'electronica',
  lavadora: 'linea-blanca',
  lavadoras: 'linea-blanca',
  'linea-blanca': 'linea-blanca',
  motocicleta: 'motocicletas',
  motocicletas: 'motocicletas',
  bicicleta: 'bicicletas',
  bicicletas: 'bicicletas',
  mueble: 'muebles',
  muebles: 'muebles',
  colchon: 'colchones',
  colchones: 'colchones',
  aire: 'aire-acondicionado',
  'aire-acondicionado': 'aire-acondicionado',
};

// Lowercase, strip accents, and dash-separate — same logic as the web slugify().
export function slugify(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeCategory(raw: string): string {
  const s = slugify(raw);
  return ALIASES[s] || s;
}

export function labelForSlug(slug: string): string {
  return CATEGORIES.find(c => c.slug === slug)?.label || slug;
}
