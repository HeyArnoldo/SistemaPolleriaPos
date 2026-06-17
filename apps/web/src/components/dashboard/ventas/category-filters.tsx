import type { ProductCategory } from '@/types/models';

const colorStyles = [
  {
    base: 'border-red-200 bg-red-50/70 text-red-700 hover:bg-red-100 hover:border-red-300',
    active: 'border-red-500 bg-red-500 text-white ring-2 ring-red-200 shadow-sm',
  },
  {
    base: 'border-orange-200 bg-orange-50/70 text-orange-700 hover:bg-orange-100 hover:border-orange-300',
    active: 'border-orange-500 bg-orange-500 text-white ring-2 ring-orange-200 shadow-sm',
  },
  {
    base: 'border-green-200 bg-green-50/70 text-green-700 hover:bg-green-100 hover:border-green-300',
    active: 'border-green-500 bg-green-500 text-white ring-2 ring-green-200 shadow-sm',
  },
];

interface CategoryFiltersProps {
  categories?: ProductCategory[];
  selectedCategory: number | null;
  onSelect: (id: number) => void;
}

export function CategoryFilters({
  categories = [],
  selectedCategory,
  onSelect,
}: CategoryFiltersProps) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category, index) => {
        const colors = colorStyles[index % colorStyles.length];
        const isActive = selectedCategory === category.id;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={`h-11 rounded-full border px-6 text-lg font-semibold tracking-normal transition-all duration-200 hover:-translate-y-px ${isActive ? colors.active : colors.base}`}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
