import { trpc } from "@/lib/trpc";
import { formatCurrency, getDeliveryStatusBadgeClass, getPaymentProgress, formatDate } from "./propUtils";
import { Building2, Search, PlusCircle, MapPin } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function PropertiesList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [unitType, setUnitType] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data: properties, isLoading } = trpc.property.properties.list.useQuery({
    country: country || undefined,
    city: city || undefined,
    unitType: unitType || undefined,
    deliveryStatus: deliveryStatus || undefined,
    search: search || undefined,
  });

  const { data: allPayments } = trpc.property.payments.all.useQuery();

  const cities = useMemo(() => {
    if (!properties) return [];
    const set = new Set(properties.map((p) => p.city));
    return Array.from(set).sort();
  }, [properties]);

  const getPropertyPaid = (propertyId: number) => {
    if (!allPayments) return 0;
    return allPayments
      .filter((p) => p.payment.propertyId === propertyId)
      .reduce((s, p) => s + (Number(p.payment.amountPaid) || 0), 0);
  };

  const selectStyle = {
    border: "1px solid #D5D0C8",
    color: "#2C3E50",
    background: "#FFFFFF",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>My Properties</h1>
        {isAdmin && (
          <button
            onClick={() => setLocation("/properties/new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: "#2D5A3D" }}
          >
            <PlusCircle className="h-4 w-4" />
            Add Property
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={country} onChange={(e) => { setCountry(e.target.value); setCity(""); }} style={selectStyle}>
          <option value="">All Countries</option>
          <option value="UAE">UAE</option>
          <option value="Egypt">Egypt</option>
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} style={selectStyle}>
          <option value="">All Cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={unitType} onChange={(e) => setUnitType(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          {["Apartment", "Villa", "Townhouse", "Duplex", "Chalet", "Penthouse", "Studio", "Land"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {["Off-Plan", "Under-Construction", "Delivered", "Handed-Over"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#666666" }} />
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
            style={{ border: "1px solid #D5D0C8", color: "#2C3E50" }}
          />
        </div>
      </div>

      {/* Properties Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-5 animate-pulse" style={{ border: "1px solid #E8E5E0" }}>
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
              <div className="h-2 bg-gray-200 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : properties && properties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map((p) => {
            const paid = getPropertyPaid(p.id);
            const progress = getPaymentProgress(p.totalPrice || "0", paid);
            return (
              <div
                key={p.id}
                onClick={() => setLocation(`/properties/${p.id}`)}
                className="bg-white rounded-lg overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md"
                style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate" style={{ color: "#2C3E50" }}>{p.propertyName}</h3>
                      <p className="text-sm" style={{ color: "#666666" }}>{p.projectName} &middot; {p.developerName}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ml-2 ${getDeliveryStatusBadgeClass(p.deliveryStatus)}`}>
                      {p.deliveryStatus}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mb-3 text-sm" style={{ color: "#666666" }}>
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{p.city}, {p.country}</span>
                    {p.country === "UAE" && <span className="ml-1">🇦🇪</span>}
                    {p.country === "Egypt" && <span className="ml-1">🇪🇬</span>}
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#EEF5EE", color: "#2D5A3D" }}>
                      {p.bedrooms === 0 ? "Studio" : `${p.bedrooms} BR`} {p.unitType}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      <div className="text-xs" style={{ color: "#666666" }}>Purchase</div>
                      <div className="font-currency text-lg font-semibold" style={{ color: "#2C3E50" }}>
                        {formatCurrency(p.totalPrice || "0", p.currency)}
                      </div>
                    </div>
                    {Number(p.currentMarketValue) > 0 && Number(p.currentMarketValue) !== Number(p.totalPrice) && (
                      <div className="text-right">
                        <div className="text-xs" style={{ color: "#2D5A3D" }}>Market Value</div>
                        <div className="font-currency text-base font-semibold" style={{ color: "#2C3E50" }}>
                          {formatCurrency(p.currentMarketValue || "0", p.currency)}
                        </div>
                        {(() => {
                          const g = Number(p.currentMarketValue) - Number(p.totalPrice);
                          return g !== 0 ? (
                            <div className="font-currency text-xs" style={{ color: g > 0 ? "#2D5A3D" : "#C0714A" }}>
                              {g > 0 ? "+" : ""}{formatCurrency(g, p.currency)}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs" style={{ color: "#666666" }}>
                      <span>Payment Progress</span>
                      <span className="font-currency">{progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#EEF5EE" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, background: progress === 100 ? "#2D5A3D" : "#4A7C59" }}
                      />
                    </div>
                  </div>

                  {p.expectedDelivery && (
                    <div className="mt-3 text-xs" style={{ color: "#666666" }}>
                      Delivery: {formatDate(p.expectedDelivery)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center" style={{ border: "1px solid #E8E5E0" }}>
          <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" style={{ color: "#2D5A3D" }} />
          <h3 className="font-semibold text-lg mb-2" style={{ color: "#2C3E50" }}>No properties yet</h3>
          <p className="text-sm mb-6" style={{ color: "#666666" }}>Add your first property to get started.</p>
          {isAdmin && (
            <button
              onClick={() => setLocation("/properties/new")}
              className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:-translate-y-0.5"
              style={{ background: "#2D5A3D" }}
            >
              Add Property
            </button>
          )}
        </div>
      )}
    </div>
  );
}
