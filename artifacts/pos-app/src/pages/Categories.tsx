import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, getGetCategoriesQueryKey
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Categories() {
  const { data: categories = [], isLoading } = useGetCategories();
  const [search, setSearch] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleOpen = (cat?: { id: number, name: string }) => {
    if (cat) {
      setEditingId(cat.id);
      setName(cat.name);
    } else {
      setEditingId(null);
      setName("");
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: { name } });
        toast({ title: "Category updated" });
      } else {
        await createMut.mutateAsync({ data: { name } });
        toast({ title: "Category created" });
      }
      queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
      setIsModalOpen(false);
    } catch (e) {
      toast({ title: "Error saving category", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
      toast({ title: "Category deleted" });
    } catch (e) {
      toast({ title: "Error deleting category", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Categories" 
        description="Manage product categories"
        action={
          <Button onClick={() => handleOpen()} className="bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/20">
            <Plus className="w-4 h-4 mr-2" /> Add Category
          </Button>
        }
      />

      <Card className="p-4 sm:p-6 shadow-md border-none ring-1 ring-border">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Search categories..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/50 border-transparent focus-visible:ring-accent h-12 rounded-xl text-base"
          />
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(cat => (
              <div key={cat.id} className="group relative bg-card border border-border p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-accent/30 transition-all">
                <h3 className="font-semibold text-lg text-foreground mb-4 pr-12 truncate">{cat.name}</h3>
                
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg" onClick={() => handleOpen(cat)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(cat.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">No categories found.</div>
            )}
          </div>
        )}
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editingId ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name" className="text-sm font-medium mb-1.5 block text-muted-foreground">Category Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="h-12 rounded-xl"
              placeholder="e.g. Beverages"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl h-11">Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 px-8" disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
