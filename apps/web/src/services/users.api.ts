import { api } from '@/lib/api';
import type { CreateUserDTO, UpdateUserDTO, User } from '@/types/models';

export const getUsers = async (): Promise<User[]> => {
  const { data } = await api.get('/users');
  return data;
};

export const createUser = async (payload: CreateUserDTO): Promise<User> => {
  const { data } = await api.post('/users', payload);
  return data;
};

export const updateUser = async (id: number, payload: UpdateUserDTO): Promise<User> => {
  const { data } = await api.patch(`/users/${id}`, payload);
  return data;
};

export const deactivateUser = async (id: number): Promise<void> => {
  await api.patch(`/users/${id}`, { isActive: false });
};
