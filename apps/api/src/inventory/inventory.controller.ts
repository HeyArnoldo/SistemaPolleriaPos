import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CategoriesService } from './services/categories.service';
import { ProductsService } from './services/products.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createProductCategorySchema,
  CreateProductCategoryDto,
} from './dto/create-product-category.dto';
import { createProductSchema, CreateProductDto } from './dto/create-product.dto';
import { updateProductSchema, UpdateProductDto } from './dto/update-product.dto';
import { z } from 'zod';

const updateCategorySchema = z.object({ name: z.string().min(1).max(255) }).partial();

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
  ) {}

  // ── Categories ────────────────────────────────────────────────────────────

  @Get('categories')
  listCategories() {
    return this.categories.findAll();
  }

  @Get('categories/:id')
  getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categories.findOne(id);
  }

  @Post('categories')
  createCategory(
    @Body(new ZodValidationPipe(createProductCategorySchema)) dto: CreateProductCategoryDto,
  ) {
    return this.categories.create(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateCategorySchema)) dto: Partial<CreateProductCategoryDto>,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categories.remove(id);
  }

  // ── Products ──────────────────────────────────────────────────────────────

  @Get('products')
  listProducts() {
    return this.products.findAll();
  }

  @Get('products/active')
  listActiveProducts() {
    return this.products.findActive();
  }

  @Get('products/:id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.products.findOne(id);
  }

  @Post('products')
  createProduct(@Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch('products/:id')
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto);
  }

  @Delete('products/:id')
  deactivateProduct(@Param('id', ParseIntPipe) id: number) {
    return this.products.deactivate(id);
  }
}
