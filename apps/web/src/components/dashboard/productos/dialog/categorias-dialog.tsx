import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useGetCategories, useCreateCategory, useUpdateCategory } from '@/hooks/use-products';
import { getErrorMessage } from '@/lib/errors';
import type { ProductCategory } from '@/types/models';

interface CategoriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoriasDialog({ open, onOpenChange }: CategoriasDialogProps) {
  const { data: categories = [], isLoading } = useGetCategories();
  const { mutate: createCategory, isPending: isCreating } = useCreateCategory();
  const { mutate: updateCategory, isPending: isUpdating } = useUpdateCategory();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCategory(
      { name: newName.trim() },
      {
        onSuccess: () => {
          toast.success('Categoria creada');
          setNewName('');
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al crear la categoria'));
        },
      },
    );
  };

  const handleStartEdit = (cat: ProductCategory) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editingName.trim()) return;
    updateCategory(
      { id: editingId, payload: { name: editingName.trim() } },
      {
        onSuccess: () => {
          toast.success('Categoria actualizada');
          setEditingId(null);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al actualizar la categoria'));
        },
      },
    );
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorias</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Input
              placeholder="Nueva categoria..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
            />
            <Button onClick={handleCreate} disabled={!newName.trim() || isCreating}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin categorias</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {categories.map((cat) => (
                <li key={cat.id} className="flex items-center gap-2">
                  {editingId === cat.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 h-8"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{cat.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleStartEdit(cat)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
