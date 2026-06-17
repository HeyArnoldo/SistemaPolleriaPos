import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from '../entities/product-category.entity';
import { CreateProductCategoryDto } from '../dto/create-product-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly repo: Repository<ProductCategory>,
  ) {}

  findAll(): Promise<ProductCategory[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<ProductCategory> {
    const category = await this.repo.findOne({ where: { id }, relations: ['products'] });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async create(dto: CreateProductCategoryDto): Promise<ProductCategory> {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Category "${dto.name}" already exists`);
    return this.repo.save(this.repo.create({ name: dto.name }));
  }

  async update(id: number, dto: Partial<CreateProductCategoryDto>): Promise<ProductCategory> {
    const category = await this.findOne(id);
    if (dto.name !== undefined) category.name = dto.name;
    return this.repo.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    const hasProducts = category.products && category.products.length > 0;
    if (hasProducts) {
      throw new ConflictException('Cannot delete a category that has products');
    }
    await this.repo.remove(category);
  }
}
