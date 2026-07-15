export const PRODUCT_CATEGORY_NAMES = ['Pollos', 'A la carta', 'Bebidas', 'Extras'] as const;

export type ProductCategoryName = (typeof PRODUCT_CATEGORY_NAMES)[number];

export type SeedProduct = {
  legacyId: number;
  name: string;
  price: number;
  category: ProductCategoryName;
};

// legacyId is kept for source traceability only. PostgreSQL generates product IDs.
export const PRODUCT_CATALOG: readonly SeedProduct[] = [
  { legacyId: 1, name: '1 POLLO ENTERO', price: 73, category: 'Pollos' },
  { legacyId: 2, name: '1/2 POLLO', price: 40, category: 'Pollos' },
  { legacyId: 3, name: '1/4 COMBO', price: 21, category: 'Pollos' },
  { legacyId: 4, name: '1/4 POLLO', price: 20, category: 'Pollos' },
  { legacyId: 5, name: '1/8 COMBO', price: 11, category: 'Pollos' },
  { legacyId: 6, name: '1/8 POLLO', price: 11, category: 'Pollos' },
  { legacyId: 7, name: '1/8 POLLO PARA LLEVAR', price: 11, category: 'Pollos' },
  { legacyId: 8, name: 'POLLO ENTERO SOLO', price: 65, category: 'A la carta' },
  { legacyId: 9, name: 'SALCHIPAPA', price: 8.5, category: 'Pollos' },
  { legacyId: 10, name: '1/2 POLLO SOLO', price: 37, category: 'A la carta' },
  { legacyId: 11, name: 'AGUA', price: 2, category: 'Bebidas' },
  { legacyId: 12, name: 'CHICHA', price: 10, category: 'Bebidas' },
  { legacyId: 13, name: 'CHICHA 1/2 JARRA', price: 5, category: 'Bebidas' },
  { legacyId: 14, name: 'COCA DE 3 LT', price: 14, category: 'Bebidas' },
  { legacyId: 15, name: 'COCACOLA 1 L', price: 8, category: 'Bebidas' },
  { legacyId: 16, name: 'COCACOLA DE 2 1/2', price: 12, category: 'Bebidas' },
  { legacyId: 17, name: 'GASEOSA 1/2 LITRO', price: 4, category: 'Bebidas' },
  { legacyId: 18, name: 'GASEOSA PERSONAL', price: 2.5, category: 'Bebidas' },
  { legacyId: 19, name: 'GASEOSA PIRAÑITA', price: 1.5, category: 'Bebidas' },
  { legacyId: 20, name: 'GORDITA', price: 5, category: 'Bebidas' },
  { legacyId: 21, name: 'INKA DE 3 LT', price: 14, category: 'Bebidas' },
  { legacyId: 22, name: 'INKAKOLA 1 L', price: 8, category: 'Bebidas' },
  { legacyId: 23, name: 'INKAKOLA DE 2 1/2', price: 12, category: 'Bebidas' },
  { legacyId: 24, name: 'LIMONADA', price: 10, category: 'Bebidas' },
  { legacyId: 25, name: 'LIMONADA 1/2 JARRA', price: 5, category: 'Bebidas' },
  { legacyId: 26, name: 'MARACUYA', price: 10, category: 'Bebidas' },
  { legacyId: 27, name: 'MARACUYA 1/2 JARRA', price: 5, category: 'Bebidas' },
  { legacyId: 28, name: 'AGUADITO ESPECIAL', price: 4, category: 'A la carta' },
  { legacyId: 29, name: 'BROASTER 1/4', price: 22, category: 'A la carta' },
  { legacyId: 30, name: 'BROASTER 1/8', price: 12, category: 'A la carta' },
  { legacyId: 31, name: 'PORCION DE CHAUFA', price: 8, category: 'A la carta' },
  { legacyId: 32, name: 'PORCION DE PAPA', price: 8, category: 'A la carta' },
  { legacyId: 33, name: 'SALCHIBROASTER', price: 17, category: 'A la carta' },
  { legacyId: 34, name: 'SALCHIHUEVO', price: 10, category: 'A la carta' },
  { legacyId: 35, name: 'SALCHIPOLLO', price: 15, category: 'A la carta' },
  { legacyId: 36, name: 'MOLLEJITAS', price: 12, category: 'A la carta' },
  { legacyId: 37, name: '1/8 POLLO SOLO', price: 9, category: 'A la carta' },
  { legacyId: 38, name: '1/4 POLLO SOLO', price: 17, category: 'A la carta' },
  { legacyId: 39, name: 'PORCION DE ENSALADA', price: 8, category: 'A la carta' },
  { legacyId: 40, name: 'AJI', price: 1, category: 'Extras' },
  { legacyId: 41, name: 'TAPER', price: 1, category: 'Extras' },
  { legacyId: 42, name: 'PURO ARROZ', price: 1, category: 'Extras' },
  { legacyId: 43, name: 'CHANCHO', price: 5, category: 'Extras' },
  { legacyId: 44, name: 'BAÑO', price: 1, category: 'Extras' },
  { legacyId: 45, name: 'GASEOSA 1L 1/2', price: 10, category: 'Bebidas' },
];
