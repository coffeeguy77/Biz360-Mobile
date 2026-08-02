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
import { ThemePicker } from "@/components/ThemePicker";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Selling } from "@/pages/marketing/Selling";
import { Buying } from "@/pages/marketing/Buying";
import { Brokers } from "@/pages/marketing/Brokers";
import { Walkthroughs } from "@/pages/marketing/Walkthroughs";
import { HowItWorks } from "@/pages/marketing/HowItWorks";
import { Compare } from "@/pages/marketing/Compare";
import { ListYourBusiness } from "@/pages/marketing/ListYourBusiness";
import { Photographers } from "@/pages/marketing/Photographers";
import { FindAPartner } from "@/pages/marketing/FindAPartner";
import { SellerDashboard } from "@/pages/seller-dashboard";
import { BrokerAnalytics } from "@/pages/broker-analytics";

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
      {/* Marketing / SEO */}
      <Route path="/buying" component={Buying} />
      <Route path="/selling" component={Selling} />
      <Route path="/brokers" component={Brokers} />
      <Route path="/walkthroughs" component={Walkthroughs} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/compare" component={Compare} />
      <Route path="/list-your-business" component={ListYourBusiness} />
      <Route path="/photographers" component={Photographers} />
      <Route path="/find-a-partner" component={FindAPartner} />
      {/* Seller & broker */}
      <Route path="/seller" component={SellerDashboard} />
      <Route path="/broker/analytics/:listingId" component={BrokerAnalytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AnimatedBackground />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <ThemePicker />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
