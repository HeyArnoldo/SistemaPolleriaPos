import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createUserSchema,
  CreateUserInput,
  updateUserSchema,
  UpdateUserInput,
} from '@app/contracts';
import { UsersService } from './users.service';
import { User } from './user.entity';

function stripPasswordHash(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash: _omitted, ...safe } = user as User & { passwordHash: string };
  void _omitted;
  return safe as Omit<User, 'passwordHash'>;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers() {
    const users = await this.usersService.findAll();
    return users.map(stripPasswordHash);
  }

  @Post()
  async createUser(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserInput) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    const user = await this.usersService.create({
      username: dto.username,
      passwordHash,
      role: dto.role as Role | undefined,
      firstName: dto.profile.firstName,
      lastName: dto.profile.lastName,
      avatarUrl: dto.profile.avatarUrl,
    });
    return stripPasswordHash(user);
  }

  @Patch(':id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserInput,
    @CurrentUser() current: User,
  ) {
    if (dto.isActive === false && id === current.id) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    let passwordHash: string | undefined;
    if (dto.password !== undefined) {
      passwordHash = await bcrypt.hash(dto.password, rounds);
    }
    const user = await this.usersService.update(id, {
      username: dto.username,
      role: dto.role as Role | undefined,
      isActive: dto.isActive,
      passwordHash,
      firstName: dto.profile?.firstName,
      lastName: dto.profile?.lastName,
      avatarUrl: dto.profile?.avatarUrl,
    });
    return stripPasswordHash(user);
  }
}
