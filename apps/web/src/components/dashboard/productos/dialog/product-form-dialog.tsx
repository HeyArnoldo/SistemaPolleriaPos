import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useCreateProduct, useUpdateProduct, useGetCategories } from '@/hooks/use-products';
import { getErrorMessage } from '@/lib/errors';
import type { Product } from '@/types/models';

interface ProductFormValues {
  name: string;
  price: string;
  categoryId: string;
  imageUrl?: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const isEdit = !!product;
  const { data: categories = [] } = useGetCategories();
  const { mutate: createProduct, isPending: isCreating } = useCreateProduct();
  const { mutate: updateProduct, isPending: isUpdating } = useUpdateProduct();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>();

  const categoryId = watch('categoryId');

  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          name: product.name,
          price: String(product.price),
          categoryId: String(product.category?.id ?? ''),
          imageUrl: product.imageUrl ?? '',
        });
      } else {
        reset({ name: '', price: '', categoryId: '', imageUrl: '' });
      }
    }
  }, [open, product, reset]);

  const onSubmit = (values: ProductFormValues) => {
    const payload = {
      name: values.name.trim(),
      price: parseFloat(values.price),
      categoryId: parseInt(values.categoryId),
      imageUrl: values.imageUrl?.trim() || undefined,
    };

    if (isEdit && product) {
      updateProduct(
        { id: product.id, payload },
        {
          onSuccess: () => {
            toast.success('Producto actualizado');
            onOpenChange(false);
          },
          onError: (err) => {
            toast.error(getErrorMessage(err, 'Error al actualizar el producto'));
          },
        },
      );
    } else {
      createProduct(payload, {
        onSuccess: () => {
          toast.success('Producto creado');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al crear el producto'));
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              {...register('name', { required: 'El nombre es requerido' })}
              placeholder="Nombre del producto"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="price">Precio</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              {...register('price', {
                required: 'El precio es requerido',
                min: { value: 0, message: 'El precio debe ser mayor a 0' },
              })}
              placeholder="0.00"
            />
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => setValue('categoryId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoria..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="imageUrl">URL de imagen (opcional)</Label>
            <Input id="imageUrl" {...register('imageUrl')} placeholder="https://..." />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
