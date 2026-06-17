import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as usersApi from '@/services/users.api';
import { QUERY_KEYS } from './query-keys';
import type { CreateUserDTO, UpdateUserDTO } from '@/types/models';

export const useGetUsers = () =>
  useQuery({ queryKey: QUERY_KEYS.users, queryFn: usersApi.getUsers });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserDTO) => usersApi.createUser(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserDTO }) =>
      usersApi.updateUser(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });
};

export const useDeactivateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.deactivateUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });
};
