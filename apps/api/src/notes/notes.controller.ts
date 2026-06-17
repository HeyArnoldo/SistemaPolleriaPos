import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateNoteInput,
  createNoteSchema,
  IdParam,
  idParamSchema,
  Note as NoteDto,
  UpdateNoteInput,
  updateNoteSchema,
} from '@app/contracts';
import { NotesService } from './notes.service';
import { Note } from './note.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';

function toDto(note: Note): NoteDto {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  async findAll(@CurrentUser() user: User): Promise<NoteDto[]> {
    return (await this.notes.findAll(user.id)).map(toDto);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
  ): Promise<NoteDto> {
    return toDto(await this.notes.findOne(user.id, id));
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createNoteSchema)) input: CreateNoteInput,
  ): Promise<NoteDto> {
    return toDto(await this.notes.create(user.id, input));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
    @Body(new ZodValidationPipe(updateNoteSchema)) input: UpdateNoteInput,
  ): Promise<NoteDto> {
    return toDto(await this.notes.update(user.id, id, input));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
  ): Promise<void> {
    await this.notes.remove(user.id, id);
  }
}
