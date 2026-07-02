import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
  passwordHash?: string;
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
    const profile = await this.profileRepo.save(
      this.profileRepo.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl ?? null,
      }),
    );
    // Use createQueryBuilder to bypass the @BeforeInsert hook that would double-hash the password
    await this.userRepo
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        username: dto.username,
        passwordHash: dto.passwordHash,
        role: dto.role ?? Role.Cashier,
        isActive: true,
        profile,
      })
      .execute();
    const created = await this.userRepo.findOne({
      where: { username: dto.username },
      relations: ['profile'],
    });
    if (!created) throw new NotFoundException(`User '${dto.username}' not found after creation`);
    return created;
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({ relations: ['profile'] });
  }

  private assertNotSystemImmutable(user: User, dto: UpdateUserDto): void {
    if (!user.isSystem) return;
    const blocked =
      dto.username !== undefined ||
      dto.role !== undefined ||
      dto.isActive !== undefined ||
      dto.passwordHash !== undefined;
    if (blocked) {
      throw new ForbiddenException('The sistema user is immovable and cannot be modified.');
    }
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    this.assertNotSystemImmutable(user, dto);
    if (dto.username !== undefined) user.username = dto.username;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.passwordHash !== undefined) user.passwordHash = dto.passwordHash;
    if (dto.firstName !== undefined) user.profile.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.profile.lastName = dto.lastName;
    if (dto.avatarUrl !== undefined) user.profile.avatarUrl = dto.avatarUrl;
    // @BeforeInsert only fires on INSERT — UPDATE path is safe from double-hashing
    return this.userRepo.save(user);
  }

  async deactivate(id: number): Promise<User> {
    const user = await this.findOne(id);
    this.assertNotSystemImmutable(user, { isActive: false });
    user.isActive = false;
    return this.userRepo.save(user);
  }
}
