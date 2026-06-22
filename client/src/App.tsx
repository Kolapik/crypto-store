import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ScrollNav from "./components/ScrollNav";
import SiteFooter from "./components/SiteFooter";
import AdminGuard from "./components/AdminGuard";

// Public pages
import Home from "./pages/Home";
import Catalogue from "./pages/Catalogue";
import WatchDetail from "./pages/WatchDetail";
import PurchaseRequest from "./pages/PurchaseRequest";
import Confirmation from "./pages/Confirmation";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";

// Admin pages
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminWatches from "./pages/AdminWatches";
import AdminWatchForm from "./pages/AdminWatchForm";
import AdminImport from "./pages/AdminImport";
import AdminRequests from "./pages/AdminRequests";
import AdminPlaceholder from "./pages/AdminPlaceholder";
import AdminHealth from "./pages/AdminHealth";
import AdminSuppliers from "./pages/AdminSuppliers";

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      <Route path="/catalogue" component={Catalogue} />
      <Route path="/watches/:slug" component={WatchDetail} />
      <Route path="/request/:watchId" component={PurchaseRequest} />
      <Route path="/request/confirmation" component={Confirmation} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />

      {/* Admin auth */}
      <Route path="/admin/login" component={AdminLogin} />

      {/* Admin protected */}
      <Route path="/admin">
        {() => <AdminGuard><AdminDashboard /></AdminGuard>}
      </Route>
      <Route path="/admin/dashboard">
        {() => <AdminGuard><AdminDashboard /></AdminGuard>}
      </Route>
      <Route path="/admin/watches">
        {() => <AdminGuard><AdminWatches /></AdminGuard>}
      </Route>
      <Route path="/admin/import">
        {() => <AdminGuard><AdminImport /></AdminGuard>}
      </Route>
      <Route path="/admin/suppliers">
        {() => <AdminGuard><AdminSuppliers /></AdminGuard>}
      </Route>
      <Route path="/admin/watches/new">
        {() => <AdminGuard><AdminWatchForm /></AdminGuard>}
      </Route>
      <Route path="/admin/watches/:id/edit">
        {() => <AdminGuard><AdminWatchForm /></AdminGuard>}
      </Route>
      <Route path="/admin/requests">
        {() => <AdminGuard><AdminRequests /></AdminGuard>}
      </Route>
      <Route path="/admin/pricing">
        {() => <AdminGuard><AdminPlaceholder title="Pricing" subtitle="Configure pricing rules and currency settings" /></AdminGuard>}
      </Route>
      <Route path="/admin/audit">
        {() => <AdminGuard><AdminPlaceholder title="Audit log" subtitle="Track all admin actions and changes" /></AdminGuard>}
      </Route>
      <Route path="/admin/health">
        {() => <AdminGuard><AdminHealth /></AdminGuard>}
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <ScrollNav />
          <Router />
          <SiteFooter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
