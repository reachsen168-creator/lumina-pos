import { useState, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit2, Trash2, Search, AlertCircle, Download, ImagePlus, X, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function imgThumb(src: string | null | undefined) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt="product"
      className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
    />
  );
}

function downloadImage(dataUrl: string, name: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${name.replace(/\s+/g, "_")}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function exportTxt(products: any[]) {
  const lines = ["Product Price List", "", ...products.map(p => `${p.name} - $${Number(p.basePrice).toFixed(2)}`)];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "products.txt"; a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(products: any[]) {
  const header = "Name,Category,Price,Stock";
  const rows = products.map(p =>
    `"${p.name}","${p.categoryName || ""}","${Number(p.basePrice).toFixed(2)}","${p.trackStock ? p.stockQty : "-"}"`
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "products.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function Products() {
  const [search, setSearch]       = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { data: products = [], isLoading } = useGetProducts({
    search: search || undefined,
    categoryId: categoryId !== "all" ? Number(categoryId) : undefined,
  });
  const { data: categories = [] } = useGetCategories();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId]     = useState<number | null>(null);

  const [name,       setName]       = useState("");
  const [catId,      setCatId]      = useState<string>("none");
  const [basePrice,  setBasePrice]  = useState("");
  const [trackStock, setTrackStock] = useState(true);
  const [stockQty,   setStockQty]   = useState("");
  const [image,      setImage]      = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { toast }   = useToast();

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
      setImage((p as any).image ?? null);
    } else {
      setEditingId(null);
      setName("");
      setCatId("none");
      setBasePrice("");
      setTrackStock(true);
      setStockQty("0");
      setImage(null);
    }
    setIsModalOpen(true);
  };

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const original = new Image();
      original.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = 120;
        canvas.height = 120;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(original, 0, 0, 120, 120);
        setImage(canvas.toDataURL("image/jpeg", 0.5));
      };
      original.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim() || !basePrice) return;
    const payload = {
      name,
      categoryId: catId === "none" ? null : Number(catId),
      basePrice: Number(basePrice),
      trackStock,
      stockQty: Number(stockQty) || 0,
      image: image ?? null,
    };
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: payload as any });
        toast({ title: "Product updated" });
      } else {
        await createMut.mutateAsync({ data: payload as any });
        toast({ title: "Product created" });
      }
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      setIsModalOpen(false);
    } catch {
      toast({ title: "Error saving product", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast({ title: "Product deleted" });
    } catch {
      toast({ title: "Error deleting product", variant: "destructive" });
    }
  };

  const allIds      = products.map(p => p.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = allIds.some(id => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectedProducts = products.filter(p => selected.has(p.id));

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
        <div className="p-4 sm:p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border focus-visible:ring-accent h-11 rounded-xl"
            />
          </div>
          <div className="w-full sm:w-56">
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

          {/* Export selected */}
          {someSelected && (
            <div className="relative shrink-0">
              <Button
                variant="outline"
                className="h-11 rounded-xl gap-2"
                onClick={() => setShowExportMenu(v => !v)}
              >
                <FileDown className="w-4 h-4" />
                Export ({selectedProducts.length})
              </Button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 w-40 overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted"
                    onClick={() => { exportTxt(selectedProducts); setShowExportMenu(false); }}
                  >
                    Export as TXT
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted"
                    onClick={() => { exportCsv(selectedProducts); setShowExportMenu(false); }}
                  >
                    Export as CSV
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
              <tr>
                <th className="px-4 py-4 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-4 font-semibold">Product</th>
                <th className="px-4 py-4 font-semibold">Category</th>
                <th className="px-4 py-4 font-semibold text-right">Price</th>
                <th className="px-4 py-4 font-semibold text-center">Stock</th>
                <th className="px-4 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No products found.</td></tr>
              ) : (
                products.map((p) => {
                  const isLowStock = p.trackStock && p.stockQty <= 5;
                  const isChecked  = selected.has(p.id);
                  const pImg = (p as any).image as string | null;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border transition-colors hover:bg-muted/30 ${isLowStock ? "bg-red-50/30" : ""} ${isChecked ? "bg-accent/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(p.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          {pImg
                            ? <img src={pImg} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                            : <div className="w-10 h-10 rounded-lg bg-muted/60 border border-border flex items-center justify-center shrink-0 text-muted-foreground text-xs">IMG</div>
                          }
                          <div>
                            <span>{p.name}</span>
                            {isLowStock && <AlertCircle className="inline w-4 h-4 text-red-500 ml-1" />}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.categoryName
                          ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">{p.categoryName}</span>
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">${p.basePrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        {!p.trackStock
                          ? <span className="text-muted-foreground text-xs">Not tracked</span>
                          : <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full font-bold text-xs ${isLowStock ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{p.stockQty}</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {pImg && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                              title="Download image"
                              onClick={() => downloadImage(pImg, p.name)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
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

      {/* Product form dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editingId ? "Edit Product" : "New Product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-2">

            {/* Image upload */}
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Product Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
              />
              {image ? (
                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-border bg-muted/20">
                  <img src={image} alt="preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                >
                  <ImagePlus className="w-7 h-7" />
                  <span className="text-sm font-medium">Tap to upload from camera or gallery</span>
                </button>
              )}
              {image && (
                <Button type="button" variant="outline" size="sm" className="w-fit rounded-xl" onClick={() => fileInputRef.current?.click()}>
                  Change Image
                </Button>
              )}
            </div>

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

            <div className="p-4 bg-muted/50 rounded-xl border border-border">
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
