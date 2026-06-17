import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as settingsApi from '@/services/settings.api';
import { QUERY_KEYS } from './query-keys';

export const useGetSettings = () =>
  useQuery({ queryKey: QUERY_KEYS.settings, queryFn: settingsApi.getSettings });

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.settings });
    },
  });
};
