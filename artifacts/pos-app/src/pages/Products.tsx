import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetProducts, useGetCategories, useCreateProduct, useUpdateProduct, useDeleteProduct, getGetProductsQueryKey
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, Search, AlertCircle, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Products() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  
  const { data: products = [], isLoading } = useGetProducts({ 
    search: search || undefined, 
    categoryId: categoryId !== "all" ? Number(categoryId) : undefined 
  });
  const { data: categories = [] } = useGetCategories();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [catId, setCatId] = useState<string>("none");
  const [basePrice, setBasePrice] = useState("");
  const [trackStock, setTrackStock] = useState(true);
  const [stockQty, setStockQty] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();
  const deleteMut = useDeleteProduct();

  const handleOpen = (p?: any) => {
    if (p) {
      setEditingId(p.id);
      setName(p.name);
      setCatId(p.categoryId ? p.categoryId.toString() : "none");
      setBasePrice(p.basePrice.toString());
      setTrackStock(p.trackStock);
      setStockQty(p.stockQty.toString());
    } else {
      setEditingId(null);
      setName("");
      setCatId("none");
      setBasePrice("");
      setTrackStock(true);
      setStockQty("0");
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !basePrice) return;
    
    const payload = {
      name,
      categoryId: catId === "none" ? null : Number(catId),
      basePrice: Number(basePrice),
      trackStock,
      stockQty: Number(stockQty) || 0
    };

    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Product updated" });
      } else {
        await createMut.mutateAsync({ data: payload });
        toast({ title: "Product created" });
      }
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      setIsModalOpen(false);
    } catch (e) {
      toast({ title: "Error saving product", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      toast({ title: "Product deleted" });
    } catch (e) {
      toast({ title: "Error deleting product", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Products" 
        description="Manage inventory and pricing"
        action={
          <Button onClick={() => handleOpen()} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 w-full sm:w-auto h-12 px-6">
            <Plus className="w-5 h-5 mr-2" /> Add Product
          </Button>
        }
      />

      <Card className="shadow-md border-none ring-1 ring-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border focus-visible:ring-accent h-11 rounded-xl"
            />
          </div>
          <div className="w-full sm:w-64">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-11 rounded-xl bg-card">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
              <tr>
                <th className="px-6 py-4 font-semibold">Product Name</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold text-right">Price</th>
                <th className="px-6 py-4 font-semibold text-center">Stock</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No products found.</td></tr>
              ) : (
                products.map((p) => {
                  const isLowStock = p.trackStock && p.stockQty <= 5;
                  return (
                    <tr key={p.id} className={`border-b border-border transition-colors hover:bg-muted/30 ${isLowStock ? 'bg-red-50/30' : ''}`}>
                      <td className="px-6 py-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {isLowStock && <AlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {p.categoryName ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                            {p.categoryName}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-foreground">${p.basePrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        {!p.trackStock ? (
                          <span className="text-muted-foreground text-xs">Not tracked</span>
                        ) : (
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full font-bold text-xs ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {p.stockQty}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpen(p)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-muted-foreground hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editingId ? 'Edit Product' : 'New Product'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-muted-foreground">Product Name *</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} className="h-11 rounded-xl" autoFocus />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price" className="text-muted-foreground">Base Price ($) *</Label>
                <Input id="price" type="number" step="0.01" value={basePrice} onChange={e => setBasePrice(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category" className="text-muted-foreground">Category</Label>
                <Select value={catId} onValueChange={setCatId}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-xl border border-border mt-2">
              <div className="flex items-center justify-between mb-4">
                <Label htmlFor="trackStock" className="font-medium cursor-pointer">Track Inventory Stock</Label>
                <Switch id="trackStock" checked={trackStock} onCheckedChange={setTrackStock} />
              </div>
              {trackStock && (
                <div className="grid gap-2">
                  <Label htmlFor="stockQty" className="text-muted-foreground text-sm">Current Stock Quantity</Label>
                  <Input id="stockQty" type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} className="h-11 rounded-xl bg-card" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl h-11">Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 px-8">Save Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
