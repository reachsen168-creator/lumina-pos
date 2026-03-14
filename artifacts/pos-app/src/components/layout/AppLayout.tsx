import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { RecoveryDialog } from "@/components/RecoveryDialog";
import { useAuth } from "@/context/AuthContext";
import { 
  LayoutDashboard, Package, Tags, ReceiptText, 
  Users, Truck, HeartCrack, ArrowRightLeft, 
  BarChart3, History, DatabaseBackup, Menu, ClipboardList, TrendingUp, Trash2, Settings2, LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sales", label: "Sales & Invoices", icon: ReceiptText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/deliveries", label: "Deliveries", icon: Truck },
  { href: "/damage-management", label: "Damage Management", icon: HeartCrack },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/delivery-report", label: "Delivery Report", icon: ClipboardList },
  { href: "/sales-report", label: "Sales Report", icon: TrendingUp },
  { href: "/trash", label: "Trash / Restore", icon: Trash2 },
  { href: "/backup", label: "System Backup", icon: DatabaseBackup },
  { href: "/history", label: "Audit Logs", icon: History },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  const NavContent = () => (
    <div className="flex flex-col h-full gap-2 p-4">
      <div className="flex items-center gap-3 px-2 py-4 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg shadow-accent/20">
          <Package className="w-5 h-5 text-white" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight">Lumina POS</span>
      </div>
      
      <nav className="flex-1 space-y-1 overflow-y-auto hide-scrollbar">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <div className={`
                flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer
                ${isActive 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10 font-medium' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }
              `}>
                <item.icon className={`w-5 h-5 ${isActive ? 'text-accent' : ''}`} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-border mt-auto space-y-1">
        <div className="px-3 py-1">
          <AutoSaveIndicator />
        </div>
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground truncate">{user?.username ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground capitalize">{user?.role ?? ""}</div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex w-full selection:bg-accent/20">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 left-0 bg-card border-r border-border z-50">
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:pl-72 flex flex-col min-h-screen relative w-full overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-40 glass border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg">Lumina</span>
          </div>

          <div className="flex items-center gap-2">
            <AutoSaveIndicator />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 border-r-0">
                <NavContent />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto overflow-x-hidden">
          <motion.div
            key={location}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="h-full w-full"
          >
            {children}
          </motion.div>
        </div>
      </main>

      <RecoveryDialog />
    </div>
  );
}
