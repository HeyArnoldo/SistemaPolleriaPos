/**
 * Rewards catalog API — calls apps/api (/api/rewards).
 * The catalog is local per sede (D2), NOT in the hub.
 */
import { api } from '@/lib/api';
import type { Reward, CreateRewardInput, UpdateRewardInput } from '@app/carbopuntos-contracts';

export const getRewards = async (activeOnly = false): Promise<Reward[]> => {
  const { data } = await api.get<Reward[]>('/rewards', {
    params: activeOnly ? { active: 'true' } : undefined,
  });
  return data;
};

export const createReward = async (payload: CreateRewardInput): Promise<Reward> => {
  const { data } = await api.post<Reward>('/rewards', payload);
  return data;
};

export const updateReward = async (id: string, payload: UpdateRewardInput): Promise<Reward> => {
  const { data } = await api.patch<Reward>(`/rewards/${id}`, payload);
  return data;
};

export const deleteReward = async (id: string): Promise<void> => {
  await api.delete(`/rewards/${id}`);
};
