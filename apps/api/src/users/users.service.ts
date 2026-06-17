import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Profile } from './profile.entity';
import { Role } from '../common/enums/role.enum';

export interface CreateUserDto {
  username: string;
  passwordHash: string;
  role?: Role;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface UpdateUserDto {
  username?: string;
  isActive?: boolean;
  role?: Role;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
  ) {}

  findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username }, relations: ['profile'] });
  }

  findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id }, relations: ['profile'] });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const profile = this.profileRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatarUrl: dto.avatarUrl ?? null,
    });
    const user = this.userRepo.create({
      username: dto.username,
      passwordHash: dto.passwordHash,
      role: dto.role ?? Role.Cashier,
      profile,
    });
    return this.userRepo.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({ relations: ['profile'] });
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (dto.username !== undefined) user.username = dto.username;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.firstName !== undefined) user.profile.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.profile.lastName = dto.lastName;
    if (dto.avatarUrl !== undefined) user.profile.avatarUrl = dto.avatarUrl;
    return this.userRepo.save(user);
  }

  async deactivate(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = false;
    return this.userRepo.save(user);
  }
}
