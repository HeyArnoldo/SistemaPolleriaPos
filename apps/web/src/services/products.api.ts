import { api } from '@/lib/api';
import type { Product, ProductCategory } from '@/types/models';

// TypeORM serializes decimals as strings; normalize price to a real number so
// the declared Product.price: number type holds at runtime (cart totals,
// ticket, sale payload all rely on it being numeric).
const normalizeProduct = (p: Product): Product => ({ ...p, price: Number(p.price) });

export const getProducts = async (): Promise<Product[]> => {
  const { data } = await api.get('/inventory/products');
  return (data as Product[]).map(normalizeProduct);
};

export const getProduct = async (id: number): Promise<Product> => {
  const { data } = await api.get(`/inventory/products/${id}`);
  return normalizeProduct(data as Product);
};

export const createProduct = async (payload: {
  name: string;
  price: number;
  categoryId: number;
  imageUrl?: string | null;
  isActive?: boolean;
}): Promise<Product> => {
  const { data } = await api.post('/inventory/products', payload);
  return normalizeProduct(data as Product);
};

export const updateProduct = async (
  id: number,
  payload: Partial<{
    name: string;
    price: number;
    categoryId: number;
    imageUrl?: string | null;
    isActive?: boolean;
  }>,
): Promise<Product> => {
  const { data } = await api.patch(`/inventory/products/${id}`, payload);
  return normalizeProduct(data as Product);
};

export const deactivateProduct = async (id: number): Promise<void> => {
  await api.patch(`/inventory/products/${id}`, { isActive: false });
};

export const getCategories = async (): Promise<ProductCategory[]> => {
  const { data } = await api.get('/inventory/categories');
  return data;
};

export const createCategory = async (payload: { name: string }): Promise<ProductCategory> => {
  const { data } = await api.post('/inventory/categories', payload);
  return data;
};

export const updateCategory = async (
  id: number,
  payload: { name: string },
): Promise<ProductCategory> => {
  const { data } = await api.patch(`/inventory/categories/${id}`, payload);
  return data;
};

export const reactivateProduct = async (id: number): Promise<void> => {
  await api.patch(`/inventory/products/${id}`, { isActive: true });
};
