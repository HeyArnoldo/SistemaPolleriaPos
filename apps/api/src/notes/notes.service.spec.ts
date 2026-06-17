import { NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { Note } from './note.entity';

describe('NotesService', () => {
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => Promise.resolve(data)),
    merge: jest.fn((target, source) => Object.assign(target, source)),
    remove: jest.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new NotesService(repo as any);

  beforeEach(() => jest.clearAllMocks());

  it('create asigna el ownerId del usuario autenticado', async () => {
    await service.create('user-1', { title: 'Hola', content: '' });
    expect(repo.create).toHaveBeenCalledWith({ title: 'Hola', content: '', ownerId: 'user-1' });
  });

  it('findOne lanza NotFound si la nota es de otro usuario', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne('user-1', 'note-ajena')).rejects.toThrow(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'note-ajena', ownerId: 'user-1' } });
  });

  it('update solo toca notas propias', async () => {
    const note = { id: 'n1', title: 'Vieja', ownerId: 'user-1' } as Note;
    repo.findOne.mockResolvedValue(note);
    const result = await service.update('user-1', 'n1', { title: 'Nueva' });
    expect(result.title).toBe('Nueva');
  });
});
