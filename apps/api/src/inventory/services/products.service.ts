import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductCategory } from '../entities/product-category.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  findAll(): Promise<Product[]> {
    return this.productRepo.find({ relations: ['category'], order: { name: 'ASC' } });
  }

  findActive(): Promise<Product[]> {
    return this.productRepo.find({
      where: { isActive: true },
      relations: ['category'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id }, relations: ['category'] });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException(`Category ${dto.categoryId} not found`);

    const product = this.productRepo.create({
      name: dto.name,
      price: dto.price,
      imageUrl: dto.imageUrl ?? null,
      isActive: dto.isActive ?? true,
      puntaje: dto.puntaje ?? 0,
      category,
    });
    return this.productRepo.save(product);
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl ?? null;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    if (dto.puntaje !== undefined) product.puntaje = dto.puntaje;
    if (dto.categoryId !== undefined) {
      const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException(`Category ${dto.categoryId} not found`);
      product.category = category;
    }
    return this.productRepo.save(product);
  }

  async deactivate(id: number): Promise<Product> {
    const product = await this.findOne(id);
    product.isActive = false;
    return this.productRepo.save(product);
  }
}
