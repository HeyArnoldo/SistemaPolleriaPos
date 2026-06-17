import { api } from '@/lib/api';
import type { StoreSetting } from '@/types/models';

export const getSettings = async (): Promise<StoreSetting> => {
  const { data } = await api.get('/settings');
  return data;
};

export const updateSettings = async (payload: { storeName: string }): Promise<StoreSetting> => {
  const { data } = await api.patch('/settings', payload);
  return data;
};
