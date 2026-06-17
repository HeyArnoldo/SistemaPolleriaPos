import { z } from 'zod';

// CRUD demo: borra este archivo (y el módulo notes en api/web) cuando
// arranques un proyecto real, o úsalo como referencia para tus features.

// Sin .default(): mantener input = output evita fricción de tipos entre
// zodResolver y react-hook-form (el form ya provee defaultValues).
export const createNoteSchema = z.object({
  title: z.string().min(1).max(160),
  content: z.string().max(10_000),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = createNoteSchema.partial();
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const noteSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Note = z.infer<typeof noteSchema>;
