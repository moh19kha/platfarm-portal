import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// ── Lazy-loaded module pages (each module only downloads when first visited) ─
const ModuleLauncher       = lazy(() => import("./pages/ModuleLauncher"));
const Home                 = lazy(() => import("./pages/Home"));
const ProductionHome       = lazy(() => import("./pages/ProductionHome"));
const PurchaseShipmentPage = lazy(() => import("./pages/PurchaseShipmentPage"));
const SalesShipmentPage    = lazy(() => import("./pages/SalesShipmentPage"));
const QuotationsHome       = lazy(() => import("./pages/QuotationsHome"));
const InvestmentHome       = lazy(() => import("./pages/InvestmentHome"));
const SupplyChainHome      = lazy(() => import("./pages/SupplyChainHome"));
const HRHome               = lazy(() => import("./pages/HRHome"));
const EmployeeListing      = lazy(() => import("./pages/EmployeeListing"));
const DMSHome              = lazy(() => import("./pages/DMSHome"));
const CompanyDocuments     = lazy(() => import("./pages/CompanyDocuments"));
const InventoryModule      = lazy(() => import("./pages/InventoryModule"));
const FinanceModule        = lazy(() => import("./pages/FinanceModule"));
const OperationsModule     = lazy(() => import("./pages/OperationsModule"));
const PeriodicMeetingsHome = lazy(() => import("./pages/PeriodicMeetingsHome"));
const OfflineOpsModule     = lazy(() => import("./pages/OfflineOpsModule"));
const PCEHome              = lazy(() => import("./pages/PCEHome"));
const PropertyPortal       = lazy(() => import("./pages/property/PropertyPortal"));
// Named-export pages — wrap so lazy() receives a default export
const Login          = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword").then(m => ({ default: m.ForgotPassword })));
const ResetPassword  = lazy(() => import("./pages/ResetPassword").then(m => ({ default: m.ResetPassword })));
const InviteAccept   = lazy(() => import("./pages/InviteAccept").then(m => ({ default: m.InviteAccept })));

// ── Page loading fallback ───────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#F7F6F3",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fontSize: 13, color: "#95A09C",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 32, height: 32, border: "3px solid #E4E1DC",
          borderTopColor: "#2D5A3D", borderRadius: "50%",
          animation: "spin 0.7s linear infinite", margin: "0 auto 12px",
        }} />
        Loading…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Module Launcher — main entry point */}
        <Route path={"/"} component={ModuleLauncher} />

        {/* Purchase & Sales Shipments module */}
        <Route path={"/dashboard"} component={Home} />
        <Route path={"/purchase"} component={Home} />
        <Route path={"/sales"} component={Home} />
        <Route path={"/agreements"} component={Home} />
        <Route path={"/users"} component={Home} />

        {/* Production module */}
        <Route path="/production" component={ProductionHome} />
        <Route path="/production/:rest*" component={ProductionHome} />

        {/* Quotation & Invoicing module */}
        <Route path="/documents" component={QuotationsHome} />
        <Route path="/documents/:rest*" component={QuotationsHome} />

        {/* Investors Relationship Management module */}
        <Route path="/investments" component={InvestmentHome} />
        <Route path="/investments/:rest*" component={InvestmentHome} />

        {/* Supply Chain Financials module */}
        <Route path="/supply-chain" component={SupplyChainHome} />
        <Route path="/supply-chain/:rest*" component={SupplyChainHome} />

        {/* HR Management module */}
        <Route path="/hr" component={HRHome} />
        <Route path="/hr/employee-listing" component={EmployeeListing} />
        <Route path="/hr/:rest*" component={HRHome} />

        {/* Document Management System module */}
        <Route path="/dms" component={DMSHome} />
        <Route path="/dms/company-documents" component={CompanyDocuments} />
        <Route path="/dms/:rest*" component={DMSHome} />

        {/* Inventory & Warehouse module */}
        <Route path="/inventory" component={InventoryModule} />
        <Route path="/inventory/:rest*" component={InventoryModule} />

        {/* Finance module */}
        <Route path="/finance" component={FinanceModule} />
        <Route path="/finance/:rest*" component={FinanceModule} />

        {/* Operations module */}
        <Route path="/operations" component={OperationsModule} />
        <Route path="/operations/:rest*" component={OperationsModule} />

        {/* Offline Operations module */}
        <Route path="/offline-ops" component={OfflineOpsModule} />
        <Route path="/incoming-shipments">{() => { window.location.replace("/offline-ops"); return null; }}</Route>
        <Route path="/offline-ops/:rest*" component={OfflineOpsModule} />

        {/* Periodic Meetings module */}
        <Route path="/meetings" component={PeriodicMeetingsHome} />
        <Route path="/meetings/:rest*" component={PeriodicMeetingsHome} />

        {/* Petty Cash & Expenses module */}
        <Route path="/pce" component={PCEHome} />
        <Route path="/pce/:rest*" component={PCEHome} />

        {/* Property Portfolio module */}
        <Route path="/property-mgmt" component={PropertyPortal} />
        <Route path="/property-mgmt/*" component={PropertyPortal} />


        {/* Standalone detail pages */}
        <Route path="/purchase/:id" component={PurchaseShipmentPage} />
        <Route path="/sales/:id" component={SalesShipmentPage} />

        {/* Auth pages */}
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password/:token" component={ResetPassword} />
        <Route path="/invite/:token" component={InviteAccept} />

        <Route path={"404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
