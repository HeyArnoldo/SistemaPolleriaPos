import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as rewardsApi from '@/services/rewards.api';
import { QUERY_KEYS } from './query-keys';
import type { CreateRewardInput, UpdateRewardInput } from '@app/carbopuntos-contracts';

export const useGetRewards = (activeOnly = false) =>
  useQuery({
    queryKey: QUERY_KEYS.rewards,
    queryFn: () => rewardsApi.getRewards(activeOnly),
    staleTime: 60_000,
  });

export const useCreateReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRewardInput) => rewardsApi.createReward(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.rewards });
    },
  });
};

export const useUpdateReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRewardInput }) =>
      rewardsApi.updateReward(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.rewards });
    },
  });
};

export const useDeleteReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rewardsApi.deleteReward(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.rewards });
    },
  });
};
