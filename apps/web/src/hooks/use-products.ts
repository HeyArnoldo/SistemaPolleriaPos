import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as productsApi from '@/services/products.api';
import { QUERY_KEYS } from './query-keys';

export const useGetProducts = () =>
  useQuery({ queryKey: QUERY_KEYS.products, queryFn: productsApi.getProducts });

export const useGetCategories = () =>
  useQuery({ queryKey: QUERY_KEYS.categories, queryFn: productsApi.getCategories });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productsApi.createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.products });
    },
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof productsApi.updateProduct>[1];
    }) => productsApi.updateProduct(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.products });
    },
  });
};

export const useDeactivateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => productsApi.deactivateProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.products });
    },
  });
};

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productsApi.createCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.categories });
    },
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name: string } }) =>
      productsApi.updateCategory(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.categories });
    },
  });
};
