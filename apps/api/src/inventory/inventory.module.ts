import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from './entities/product-category.entity';
import { Product } from './entities/product.entity';
import { CategoriesService } from './services/categories.service';
import { ProductsService } from './services/products.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductCategory, Product])],
  providers: [CategoriesService, ProductsService],
  controllers: [InventoryController],
  exports: [ProductsService, CategoriesService],
})
export class InventoryModule {}
