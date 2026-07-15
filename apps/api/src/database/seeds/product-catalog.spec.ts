import { PRODUCT_CATALOG, PRODUCT_CATEGORY_NAMES } from './product-catalog';

describe('product seed catalog', () => {
  it('contains the complete legacy catalog in source order', () => {
    expect(PRODUCT_CATALOG).toHaveLength(45);
    expect(PRODUCT_CATALOG.map((product) => product.legacyId)).toEqual(
      Array.from({ length: 45 }, (_, index) => index + 1),
    );
  });

  it('contains only unique, normalized product names', () => {
    const names = PRODUCT_CATALOG.map((product) => product.name);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toBe(name.trim());
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('uses only canonical categories and valid prices', () => {
    const categoryNames = new Set<string>(PRODUCT_CATEGORY_NAMES);

    for (const product of PRODUCT_CATALOG) {
      expect(categoryNames.has(product.category)).toBe(true);
      expect(Number.isFinite(product.price)).toBe(true);
      expect(product.price).toBeGreaterThan(0);
    }
  });

  it('preserves the expected product count per category', () => {
    const counts = Object.fromEntries(PRODUCT_CATEGORY_NAMES.map((name) => [name, 0]));

    for (const product of PRODUCT_CATALOG) {
      counts[product.category] += 1;
    }

    expect(counts).toEqual({
      Pollos: 8,
      'A la carta': 14,
      Bebidas: 18,
      Extras: 5,
    });
  });
});
