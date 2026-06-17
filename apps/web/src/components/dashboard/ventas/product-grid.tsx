import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { ProductCard } from './product-card';
import type { Product, ProductCategory } from '@/types/models';

interface ProductGridProps {
  products: Product[];
  categories: ProductCategory[];
  onAddProduct: (product: Product) => void;
}

export function ProductGrid({ products, categories, onAddProduct }: ProductGridProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const filtered = products.filter((p) => {
    if (!p.isActive) return false;
    if (selectedCategory !== null && p.category?.id !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar producto..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={selectedCategory === null ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setSelectedCategory(null)}
        >
          Todos
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat.id}
            variant={selectedCategory === cat.id ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.name}
          </Badge>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            No se encontraron productos
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={onAddProduct} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
