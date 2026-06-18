/**
 * T5.1 — Product.puntaje field validation.
 * Tests the puntaje property on the Product entity (default 0, integer, non-negative).
 */
import { Product } from './entities/product.entity';

describe('Product entity — puntaje field', () => {
  it('puntaje defaults to 0 when not set', () => {
    const product = new Product();
    // Column default is applied at DB level; TypeScript entity default must also be 0.
    expect(product.puntaje).toBe(0);
  });

  it('accepts a positive integer puntaje', () => {
    const product = new Product();
    product.puntaje = 10;
    expect(product.puntaje).toBe(10);
  });

  it('puntaje is a number type', () => {
    const product = new Product();
    product.puntaje = 5;
    expect(typeof product.puntaje).toBe('number');
  });
});
