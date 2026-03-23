import { Router, Route, Switch } from "wouter";
import PropDashboardLayout from "./PropDashboardLayout";
import Dashboard from "./Dashboard";
import PropertiesList from "./PropertiesList";
import PropertyDetail from "./PropertyDetail";
import PropertyForm from "./PropertyForm";
import PaymentCalendar from "./PaymentCalendar";
import LiabilityForecast from "./LiabilityForecast";
import Documents from "./Documents";
import Rentals from "./Rentals";
import SettingsPage from "./Settings";

export default function PropertyPortal() {
  return (
    <Router base="/property-mgmt">
      <PropDashboardLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/properties/new" component={PropertyForm} />
          <Route path="/properties/:id/edit" component={PropertyForm} />
          <Route path="/properties/:id" component={PropertyDetail} />
          <Route path="/properties" component={PropertiesList} />
          <Route path="/payments" component={PaymentCalendar} />
          <Route path="/liability" component={LiabilityForecast} />
          <Route path="/rentals" component={Rentals} />
          <Route path="/documents" component={Documents} />
          <Route path="/settings" component={SettingsPage} />
          <Route>
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h2 className="text-2xl font-bold mb-2" style={{ color: "#2C3E50" }}>Page Not Found</h2>
              <p style={{ color: "#666" }}>This page doesn't exist in the property portal.</p>
            </div>
          </Route>
        </Switch>
      </PropDashboardLayout>
    </Router>
  );
}
