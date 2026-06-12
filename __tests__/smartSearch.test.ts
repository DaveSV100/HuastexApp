// The SaleModal product search must behave like the web inventory search:
// word-order-free, accent-insensitive and case-insensitive.
import { matchesAllKeywords, normalizeSearchText } from '../src/utils/smartSearch';

describe('normalizeSearchText', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeSearchText('Refrigerador HISENSE Ñandú á é í ó ú')).toBe(
      'refrigerador hisense nandu a e i o u',
    );
  });

  it('tolerates non-string values', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
    expect(normalizeSearchText(123)).toBe('123');
  });
});

describe('matchesAllKeywords', () => {
  const product = 'Refrigerador Hisense 18 Pies RT80D6AAX';

  it.each([
    'Refrigerador Hisense',
    'hisense refrigerador',
    'refrigerador 18 pies hisense',
    'hisense 18 pies refrigerador',
    'REFRIGERADOR hisense',
    'refrigerádor hisénse', // typed with accents, product has none
  ])('finds "%s"', query => {
    expect(matchesAllKeywords(product, query)).toBe(true);
  });

  it('matches accented product names from unaccented queries', () => {
    expect(matchesAllKeywords('Colchón Áurea König', 'konig colchon aurea')).toBe(
      true,
    );
  });

  it('requires every keyword to be present', () => {
    expect(matchesAllKeywords(product, 'hisense congelador')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesAllKeywords(product, '')).toBe(true);
    expect(matchesAllKeywords(product, '   ')).toBe(true);
  });
});
