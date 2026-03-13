import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInvoices, useDeleteInvoice, useDuplicateInvoice, getGetInvoicesQueryKey
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DateShortcuts } from "@/components/ui/date-shortcuts";
import { Plus, Search, FileText, Copy, Trash2, Edit, Truck, Clipboard, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function safeFormatDate(value: string | null | undefined, fmt: string): string {
  if (!value) return "N/A";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "N/A" : format(d, fmt);
}

function buildInvoiceText(inv: any): string {
  const line = "─".repeat(44);
  const dateLine = safeFormatDate(inv.createdAt ?? inv.date, "dd MMMM yyyy HH:mm");

  const rows = (inv.items ?? []).map((item: any) => {
    const name = String(item.productName ?? "").padEnd(22).slice(0, 22);
    const qty  = String(item.qty).padStart(4);
    const price = `$${Number(item.price).toFixed(2)}`.padStart(8);
    const sub   = `$${Number(item.subtotal).toFixed(2)}`.padStart(10);
    return `  ${name} ${qty} ${price} ${sub}`;
  });

  const parts: string[] = [
    "LUMINA POS",
    line,
    `Invoice : ${inv.invoiceNo}`,
    `Date    : ${dateLine}`,
    `Customer: ${inv.customerName}`,
  ];

  if (inv.deliveryNo) parts.push(`Delivery: ${inv.deliveryNo}`);
  if (inv.note)       parts.push(`Note    : ${inv.note}`);

  parts.push(line);
  parts.push("  Product                 Qty    Price   Subtotal");
  parts.push("  " + "─".repeat(42));
  parts.push(...rows);
  parts.push(line);
  parts.push(`  TOTAL${" ".repeat(34)}$${Number(inv.total).toFixed(2)}`);
  parts.push(line);

  return parts.join("\n");
}

export default function Sales() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: invoices = [], isLoading } = useGetInvoices({
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMut = useDeleteInvoice();
  const dupMut = useDuplicateInvoice();

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetInvoicesQueryKey() });
      toast({ title: "Invoice deleted" });
    } catch {
      toast({ title: "Error deleting invoice", variant: "destructive" });
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await dupMut.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetInvoicesQueryKey() });
      toast({ title: "Invoice duplicated" });
    } catch {
      toast({ title: "Error duplicating", variant: "destructive" });
    }
  };

  const fetchFullInvoice = async (id: number) => {
    const res = await fetch(`/api/invoices/${id}`);
    if (!res.ok) throw new Error("Failed to fetch invoice");
    return res.json();
  };

  const handleCopy = async (id: number) => {
    try {
      const inv = await fetchFullInvoice(id);
      await navigator.clipboard.writeText(buildInvoiceText(inv));
      toast({ title: "Invoice copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy invoice", variant: "destructive" });
    }
  };

  const handleExport = async (id: number, invoiceNo: string) => {
    try {
      const inv = await fetchFullInvoice(id);
      const text = buildInvoiceText(inv);
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNo}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Exported ${invoiceNo}.txt` });
    } catch {
      toast({ title: "Failed to export invoice", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Invoices"
        description="Manage all sale transactions"
        action={
          <Link href="/sales/new">
            <Button className="bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/20 h-12 px-6 w-full sm:w-auto">
              <Plus className="w-5 h-5 mr-2" /> New Sale
            </Button>
          </Link>
        }
      />

      <Card className="shadow-md border-none ring-1 ring-border p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by customer or invoice #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/50 border-transparent focus-visible:ring-accent h-11 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-xl bg-card" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-xl bg-card" />
          </div>
        </div>

        <DateShortcuts onSelect={(f, t) => { setDateFrom(f); setDateTo(t); }} />

        {/* Invoice list */}
        <div className="mt-6">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center bg-muted/30 rounded-2xl border border-dashed border-border mt-4">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-foreground font-medium">No invoices found</p>
              <p className="text-sm text-muted-foreground mt-1">Adjust filters or create a new sale.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
              {invoices.map((inv) => (
                <div key={inv.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col">

                  {/* Header row */}
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-md mb-2 inline-block">
                        {inv.invoiceNo}
                      </span>
                      <h3 className="font-bold text-lg text-foreground line-clamp-1">{inv.customerName}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {safeFormatDate((inv as any).createdAt ?? inv.date, "dd MMMM yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-display font-bold text-foreground">${inv.total.toFixed(2)}</p>
                      {inv.deliveryNo && (
                        <p className="text-xs text-blue-600 font-medium mt-1 flex items-center justify-end gap-1">
                          <Truck className="w-3 h-3" /> {inv.deliveryNo}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="mt-auto pt-4 border-t border-border flex flex-wrap gap-1 items-center">
                    <Button
                      variant="ghost" size="sm"
                      className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
                      onClick={() => handleDuplicate(inv.id)}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
                      onClick={() => handleCopy(inv.id)}
                    >
                      <Clipboard className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
                      onClick={() => handleExport(inv.id, inv.invoiceNo)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Export
                    </Button>

                    <div className="ml-auto flex gap-1">
                      <Link href={`/sales/${inv.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600 rounded-lg"
                        onClick={() => handleDelete(inv.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
