import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as pmApi from '@/services/payment-methods.api';
import { QUERY_KEYS } from './query-keys';

export const useGetPaymentMethods = () =>
  useQuery({ queryKey: QUERY_KEYS.paymentMethods, queryFn: pmApi.getPaymentMethods });

export const useCreatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pmApi.createPaymentMethod,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.paymentMethods });
    },
  });
};

export const useUpdatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof pmApi.updatePaymentMethod>[1];
    }) => pmApi.updatePaymentMethod(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.paymentMethods });
    },
  });
};

export const useGetAllPaymentMethods = () =>
  useQuery({
    queryKey: [...QUERY_KEYS.paymentMethods, 'all'],
    queryFn: pmApi.getAllPaymentMethods,
  });
