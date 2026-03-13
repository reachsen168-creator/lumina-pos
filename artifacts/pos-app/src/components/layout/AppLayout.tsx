import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Package, Tags, ReceiptText, 
  Users, Truck, HeartCrack, ArrowRightLeft, 
  BarChart3, History, DatabaseBackup, Menu, X, ClipboardList, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";

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
  { href: "/sales-report",    label: "Sales Report",    icon: TrendingUp },
  { href: "/history", label: "History Logs", icon: History },
  { href: "/settings", label: "Backup & Restore", icon: DatabaseBackup },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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

      <div className="pt-4 border-t border-border mt-auto">
        <div className="px-3 py-2 text-xs text-muted-foreground font-medium">
          Logged in as Admin
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
        </header>

        {/* Page Content with Animation */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
