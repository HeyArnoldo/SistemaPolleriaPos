import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNoteInput, UpdateNoteInput } from '@app/contracts';
import { Note } from './note.entity';

@Injectable()
export class NotesService {
  constructor(@InjectRepository(Note) private readonly repo: Repository<Note>) {}

  findAll(ownerId: string): Promise<Note[]> {
    return this.repo.find({ where: { ownerId }, order: { updatedAt: 'DESC' } });
  }

  // Scoping por ownerId: nadie ve ni toca notas ajenas.
  async findOne(ownerId: string, id: string): Promise<Note> {
    const note = await this.repo.findOne({ where: { id, ownerId } });
    if (!note) throw new NotFoundException('Nota no encontrada');
    return note;
  }

  create(ownerId: string, input: CreateNoteInput): Promise<Note> {
    return this.repo.save(this.repo.create({ ...input, ownerId }));
  }

  async update(ownerId: string, id: string, input: UpdateNoteInput): Promise<Note> {
    const note = await this.findOne(ownerId, id);
    this.repo.merge(note, input);
    return this.repo.save(note);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const note = await this.findOne(ownerId, id);
    await this.repo.remove(note);
  }
}
