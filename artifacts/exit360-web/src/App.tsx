import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Home } from "@/pages/home";
import { Listings } from "@/pages/listings";
import { ListingDetail } from "@/pages/listing-detail";
import { SignIn } from "@/pages/sign-in";
import { ReportPage } from "@/pages/report";
import { BuyersLogin } from "@/pages/buyers-login";
import { BuyersPortal } from "@/pages/buyers-portal";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/listings" component={Listings} />
      <Route path="/listings/:id" component={ListingDetail} />
      <Route path="/reports/:listingId/:versionId" component={ReportPage} />
      <Route path="/reports/:listingId" component={ReportPage} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/buyers" component={BuyersLogin} />
      <Route path="/buyers/portal" component={BuyersPortal} />
      <Route component={NotFound} />
    </Switch>
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
