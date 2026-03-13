import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/Dashboard";
import Categories from "@/pages/Categories";
import Products from "@/pages/Products";
import Sales from "@/pages/Sales";
import SaleForm from "@/pages/SaleForm";
import Customers from "@/pages/Customers";
import Deliveries from "@/pages/Deliveries";
import DamagedItems from "@/pages/DamagedItems";
import Transfers from "@/pages/Transfers";
import Reports from "@/pages/Reports";
import HistoryLogs from "@/pages/HistoryLogs";
import Backup from "@/pages/Backup";
import DeliveryPacking from "@/pages/DeliveryPacking";
import DeliveryReport from "@/pages/DeliveryReport";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/categories" component={Categories} />
        <Route path="/products" component={Products} />
        <Route path="/sales" component={Sales} />
        <Route path="/sales/new" component={SaleForm} />
        <Route path="/sales/:id/packing" component={DeliveryPacking} />
        <Route path="/sales/:id" component={SaleForm} />
        <Route path="/customers" component={Customers} />
        <Route path="/deliveries" component={Deliveries} />
        <Route path="/damaged" component={DamagedItems} />
        <Route path="/transfers" component={Transfers} />
        <Route path="/reports" component={Reports} />
        <Route path="/delivery-report" component={DeliveryReport} />
        <Route path="/history" component={HistoryLogs} />
        <Route path="/settings" component={Backup} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
