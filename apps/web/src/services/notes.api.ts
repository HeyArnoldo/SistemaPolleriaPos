import { api } from '@/lib/api';
import type { CreateNoteInput, Note, UpdateNoteInput } from '@app/contracts';

// CRUD demo — referencia de cómo tipar un service con @app/contracts.
export const notesApi = {
  list: async (): Promise<Note[]> => (await api.get<Note[]>('/notes')).data,
  create: async (input: CreateNoteInput): Promise<Note> =>
    (await api.post<Note>('/notes', input)).data,
  update: async (id: string, input: UpdateNoteInput): Promise<Note> =>
    (await api.patch<Note>(`/notes/${id}`, input)).data,
  remove: async (id: string): Promise<void> => {
    await api.delete(`/notes/${id}`);
  },
};
