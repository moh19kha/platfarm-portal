import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, getDeliveryStatusBadgeClass, getPaymentStatusBadgeClass, getPaymentProgress, sqmToSqft } from "./propUtils";
import { ArrowLeft, Edit, MapPin, Bed, Bath, Maximize, Car, Building2, FileText, Upload, Download, Trash2, Plus, CreditCard, MessageSquare, Calendar, Clock, User, Phone, Mail, DollarSign, TrendingUp, Tag, FolderOpen } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";

export default function PropertyDetail() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const params = useParams<{ id: string }>();
  const propertyId = Number(params.id);
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showAddInstallment, setShowAddInstallment] = useState(false);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  const { data: property, isLoading, refetch: refetchProperty } = trpc.property.properties.getById.useQuery({ id: propertyId });
  const { data: payments, refetch: refetchPayments } = trpc.property.payments.byProperty.useQuery({ propertyId });
  const { data: contractsList } = trpc.property.contracts.byProperty.useQuery({ propertyId });
  const { data: docs, refetch: refetchDocs } = trpc.property.documents.byProperty.useQuery({ propertyId });
  const { data: activityLogs, refetch: refetchActivity } = trpc.property.activityLog.byProperty.useQuery({ propertyId });

  const recordPaymentMut = trpc.property.payments.recordPayment.useMutation({
    onSuccess: () => { refetchPayments(); setShowPaymentModal(false); toast.success("Payment recorded successfully"); },
    onError: () => toast.error("Failed to record payment"),
  });

  const addInstallmentMut = trpc.property.payments.create.useMutation({
    onSuccess: () => { refetchPayments(); setShowAddInstallment(false); toast.success("Installment added"); },
  });

  const uploadDocMut = trpc.property.documents.upload.useMutation({
    onSuccess: () => { refetchDocs(); setShowUploadDoc(false); toast.success("Document uploaded"); },
    onError: () => toast.error("Upload failed"),
  });

  const deleteDocMut = trpc.property.documents.delete.useMutation({
    onSuccess: () => { refetchDocs(); toast.success("Document deleted"); },
  });

  const createActivityMut = trpc.property.activityLog.create.useMutation({
    onSuccess: () => { refetchActivity(); setShowAddActivity(false); toast.success("Activity logged"); },
    onError: () => toast.error("Failed to log activity"),
  });

  const deleteActivityMut = trpc.property.activityLog.delete.useMutation({
    onSuccess: () => { refetchActivity(); toast.success("Activity deleted"); },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
        <div className="bg-white rounded-lg p-6 animate-pulse" style={{ border: "1px solid #E8E5E0" }}>
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-2" style={{ color: "#2C3E50" }}>Property not found</h2>
        <button onClick={() => setLocation("/properties")} className="text-sm underline" style={{ color: "#4A7C59" }}>Back to properties</button>
      </div>
    );
  }

  const totalPaid = payments?.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0) || 0;
  const totalOutstanding = (Number(property.totalPrice) || 0) - totalPaid;
  const progress = getPaymentProgress(property.totalPrice || "0", totalPaid);
  const nextPayment = payments?.find((p) => p.paymentStatus !== "Paid" && p.dueDate >= new Date().toISOString().split("T")[0]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "payments", label: "Payments" },
    { id: "contract", label: "Contract" },
    { id: "documents", label: "Documents" },
    { id: "activity", label: "Activity Log" },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={() => setLocation("/properties")} className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80" style={{ color: "#4A7C59" }}>
        <ArrowLeft className="h-4 w-4" /> Back to Properties
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>{property.propertyName}</h1>
              <p className="text-sm mt-1" style={{ color: "#666666" }}>{property.projectName} &middot; {property.developerName}</p>
              <div className="flex items-center gap-1 mt-1 text-sm" style={{ color: "#666666" }}>
                <MapPin className="h-3.5 w-3.5" /> {property.city}, {property.country}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {property.purchaseType === "Secondary Market" && (
                <span className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: "#FEF9F5", color: "#C0714A", border: "1px solid #F0D5C4" }}>
                  Secondary Market
                </span>
              )}
              {property.status === "Sold" && (
                <span className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: "#FFF0E8", color: "#A8613F", border: "1px solid #C0714A33" }}>
                  Sold
                </span>
              )}
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${getDeliveryStatusBadgeClass(property.deliveryStatus)}`}>
                {property.deliveryStatus}
              </span>
              {isAdmin && (
                <button onClick={() => setLocation(`/properties/${property.id}/edit`)} className="p-2 rounded-lg transition-colors" style={{ border: "1px solid #D5D0C8", color: "#666666" }}>
                  <Edit className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid #E8E5E0" }}>
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: "#666666" }}>Purchase Price</div>
              <div className="font-currency text-lg font-semibold" style={{ color: "#2C3E50" }}>{formatCurrency(property.totalPrice || "0", property.currency)}</div>
            </div>
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: "#2D5A3D" }}>Market Value</div>
              <div className="font-currency text-lg font-semibold" style={{ color: "#2C3E50" }}>
                {formatCurrency(property.currentMarketValue || property.totalPrice || "0", property.currency)}
              </div>
              {(() => {
                const mv = Number(property.currentMarketValue) || 0;
                const pp = Number(property.totalPrice) || 0;
                const g = mv - pp;
                if (mv > 0 && g !== 0) return (
                  <div className="font-currency text-xs mt-0.5" style={{ color: g > 0 ? "#2D5A3D" : "#C0714A" }}>
                    {g > 0 ? "+" : ""}{formatCurrency(g, property.currency)}
                  </div>
                );
                return null;
              })()}
            </div>
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: "#666666" }}>Amount Paid</div>
              <div className="font-currency text-lg font-semibold" style={{ color: "#2D5A3D" }}>{formatCurrency(totalPaid, property.currency)}</div>
            </div>
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: "#666666" }}>Outstanding</div>
              <div className="font-currency text-lg font-semibold" style={{ color: "#C0714A" }}>{formatCurrency(totalOutstanding, property.currency)}</div>
            </div>
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: "#666666" }}>Payment Progress</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "#EEF5EE" }}>
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "#2D5A3D" }} />
                </div>
                <span className="font-currency text-sm font-semibold" style={{ color: "#2C3E50" }}>{progress}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ background: "#EEF5EE" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap"
            style={{
              background: activeTab === tab.id ? "#FFFFFF" : "transparent",
              color: activeTab === tab.id ? "#2D5A3D" : "#666666",
              boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab property={property} />}
      {activeTab === "payments" && (
        <PaymentsTab
          payments={payments || []}
          property={property}
          totalPaid={totalPaid}
          totalOutstanding={totalOutstanding}
          progress={progress}
          nextPayment={nextPayment}
          onRecordPayment={(p: any) => { setSelectedPayment(p); setShowPaymentModal(true); }}
          onAddInstallment={() => setShowAddInstallment(true)}
          isAdmin={isAdmin}
        />
      )}
      {activeTab === "contract" && <ContractTab contracts={contractsList || []} />}
      {activeTab === "documents" && (
        <DocumentsTab docs={docs || []} onUpload={() => setShowUploadDoc(true)} onDelete={(id: number) => deleteDocMut.mutate({ id })} isAdmin={isAdmin} />
      )}
      {activeTab === "activity" && (
        <ActivityLogTab
          activities={activityLogs || []}
          onAdd={() => setShowAddActivity(true)}
          onDelete={(id: number) => deleteActivityMut.mutate({ id })}
          isAdmin={isAdmin}
        />
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        payment={selectedPayment}
        currency={property.currency}
        onSubmit={(data: any) => recordPaymentMut.mutate(data)}
        isLoading={recordPaymentMut.isPending}
      />

      {/* Add Installment Modal */}
      <AddInstallmentModal
        open={showAddInstallment}
        onClose={() => setShowAddInstallment(false)}
        propertyId={propertyId}
        nextNumber={(payments?.length || 0) + 1}
        onSubmit={(data: any) => addInstallmentMut.mutate(data)}
        isLoading={addInstallmentMut.isPending}
      />

      {/* Upload Document Modal */}
      <UploadDocModal
        open={showUploadDoc}
        onClose={() => setShowUploadDoc(false)}
        propertyId={propertyId}
        onSubmit={(data: any) => uploadDocMut.mutate(data)}
        isLoading={uploadDocMut.isPending}
      />

      {/* Add Activity Modal */}
      <AddActivityModal
        open={showAddActivity}
        onClose={() => setShowAddActivity(false)}
        propertyId={propertyId}
        onSubmit={(data: any) => createActivityMut.mutate(data)}
        isLoading={createActivityMut.isPending}
      />
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────

function OverviewTab({ property }: { property: any }) {
  const sections = [
    {
      title: "Location",
      items: [
        { label: "Country", value: property.country },
        { label: "City", value: property.city },
        { label: "District", value: property.district },
        { label: "Address", value: property.fullAddress },
      ],
    },
    {
      title: "Unit Specifications",
      items: [
        { label: "Type", value: property.unitType },
        { label: "Bedrooms", value: property.bedrooms === 0 ? "Studio" : property.bedrooms },
        { label: "Bathrooms", value: property.bathrooms },
        { label: "Built-up Area", value: property.builtUpAreaSqm ? `${property.builtUpAreaSqm} sqm (${sqmToSqft(property.builtUpAreaSqm)} sqft)` : null },
        { label: "Plot Area", value: property.plotAreaSqm ? `${property.plotAreaSqm} sqm` : null },
        { label: "Floor", value: property.floorNumber },
        { label: "Unit Number", value: property.unitNumber },
        { label: "Building", value: property.buildingName },
        { label: "View", value: property.viewType },
        { label: "Furnishing", value: property.furnishing },
        { label: "Parking Spaces", value: property.parkingSpaces },
      ],
    },
    {
      title: "Purchase Details",
      items: [
        { label: "Purchase Date", value: formatDate(property.purchaseDate) },
        { label: "Purchase Type", value: property.purchaseType || "Direct" },
        { label: "Expected Delivery", value: formatDate(property.expectedDelivery) },
        { label: "Actual Delivery", value: formatDate(property.actualDelivery) },
        { label: "Purpose", value: property.purpose },
        { label: "Status", value: property.status },
      ],
    },
    {
      title: "Valuation",
      items: [
        { label: "Current Market Value", value: property.currentMarketValue ? formatCurrency(property.currentMarketValue, property.currency) : null, isCurrency: true },
        { label: "Last Assessed", value: formatDate(property.valueLastUpdated) },
      ],
    },
  ];

  // Secondary Market section
  const hasSecondaryMarket = property.purchaseType === "Secondary Market";
  const secondarySection = hasSecondaryMarket ? {
    title: "Secondary Market Purchase",
    items: [
      { label: "Original Contract Value", value: property.originalContractValue ? formatCurrency(property.originalContractValue, property.currency) : null, isCurrency: true },
      { label: "Premium Paid", value: property.premiumPaid ? formatCurrency(property.premiumPaid, property.currency) : null, isCurrency: true },
      { label: "Total Purchase Price", value: property.totalPrice ? formatCurrency(property.totalPrice, property.currency) : null, isCurrency: true },
      { label: "Seller Name", value: property.sellerName },
      { label: "Seller Contact", value: property.sellerContact },
    ],
  } : null;

  // Sale tracking section
  const hasSale = property.status === "Sold";
  const saleSection = hasSale ? {
    title: "Sale Details",
    items: [
      { label: "Sale Date", value: formatDate(property.saleDate) },
      { label: "Sale Price", value: property.salePrice ? formatCurrency(property.salePrice, property.currency) : null, isCurrency: true },
      { label: "Buyer Name", value: property.buyerName },
      { label: "Buyer Contact", value: property.buyerContact },
      { label: "Buyer Email", value: property.buyerEmail },
      { label: "Premium Received", value: property.premiumReceived ? formatCurrency(property.premiumReceived, property.currency) : null, isCurrency: true },
    ],
  } : null;

  // Calculate profit if sold
  const profit = hasSale && property.salePrice && property.totalPrice
    ? Number(property.salePrice) - Number(property.totalPrice)
    : null;

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title} className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <div className="px-5 py-3" style={{ background: "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
            <h3 className="font-semibold text-white text-sm">{section.title}</h3>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.items.filter((i) => i.value != null && i.value !== "" && i.value !== "\u2014").map((item) => (
              <div key={item.label}>
                <div className="text-xs font-medium mb-1" style={{ color: "#666666" }}>{item.label}</div>
                <div className={`text-sm font-medium ${(item as any).isCurrency ? "font-currency" : ""}`} style={{ color: "#2C3E50" }}>
                  {String(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Secondary Market Section */}
      {secondarySection && (
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #F0D5C4" }}>
          <div className="px-5 py-3" style={{ background: "linear-gradient(to right, #C0714A, #A8613F)" }}>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Tag className="h-4 w-4" /> {secondarySection.title}
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {secondarySection.items.filter((i) => i.value != null && i.value !== "").map((item) => (
              <div key={item.label}>
                <div className="text-xs font-medium mb-1" style={{ color: "#666666" }}>{item.label}</div>
                <div className={`text-sm font-medium ${item.isCurrency ? "font-currency" : ""}`} style={{ color: "#2C3E50" }}>
                  {String(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sale Details Section */}
      {saleSection && (
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #D5E5D5" }}>
          <div className="px-5 py-3" style={{ background: "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> {saleSection.title}
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {saleSection.items.filter((i) => i.value != null && i.value !== "").map((item) => (
                <div key={item.label}>
                  <div className="text-xs font-medium mb-1" style={{ color: "#666666" }}>{item.label}</div>
                  <div className={`text-sm font-medium ${item.isCurrency ? "font-currency" : ""}`} style={{ color: "#2C3E50" }}>
                    {String(item.value)}
                  </div>
                </div>
              ))}
            </div>
            {/* Profit/Loss highlight */}
            {profit !== null && (
              <div className="rounded-lg p-4" style={{ background: profit >= 0 ? "#EEF5EE" : "#FFF0E8", border: `1px solid ${profit >= 0 ? "#C5DDC5" : "#F0D5C4"}` }}>
                <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: profit >= 0 ? "#4A7C59" : "#C0714A" }}>
                  {profit >= 0 ? "Profit" : "Loss"}
                </div>
                <div className="text-2xl font-bold font-currency" style={{ color: profit >= 0 ? "#2D5A3D" : "#C0714A" }}>
                  {formatCurrency(Math.abs(profit), property.currency)}
                </div>
                {property.saleNotes && (
                  <div className="text-sm mt-2" style={{ color: "#666666" }}>{property.saleNotes}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {property.notes && (
        <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #E8E5E0" }}>
          <h3 className="font-semibold text-sm mb-2" style={{ color: "#2C3E50" }}>Notes</h3>
          <p className="text-sm" style={{ color: "#666666" }}>{property.notes}</p>
        </div>
      )}

      {property.latitude && property.longitude && (
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <div className="px-5 py-3" style={{ background: "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
            <h3 className="font-semibold text-white text-sm">Location Map</h3>
          </div>
          <div className="h-[300px]">
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activity Log Tab ──────────────────────────────────────────────────

function ActivityLogTab({ activities, onAdd, onDelete, isAdmin }: { activities: any[]; onAdd: () => void; onDelete: (id: number) => void; isAdmin?: boolean }) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "Communication": return <Phone className="h-4 w-4" />;
      case "Meeting": return <User className="h-4 w-4" />;
      case "Payment": return <DollarSign className="h-4 w-4" />;
      case "Inspection": return <Building2 className="h-4 w-4" />;
      case "Document": return <FileText className="h-4 w-4" />;
      case "Sale": return <TrendingUp className="h-4 w-4" />;
      case "Status Update": return <Tag className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "Payment": return { bg: "#EEF5EE", border: "#C5DDC5", text: "#2D5A3D" };
      case "Sale": return { bg: "#FEF9F5", border: "#F0D5C4", text: "#C0714A" };
      case "Communication": return { bg: "#EEF5EE", border: "#D5E5D5", text: "#4A7C59" };
      case "Meeting": return { bg: "#F8FAF8", border: "#D5E5D5", text: "#4A7C59" };
      default: return { bg: "#F8FAF8", border: "#E8E5E0", text: "#666666" };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold" style={{ color: "#2C3E50" }}>
          {activities.length} {activities.length === 1 ? "entry" : "entries"}
        </h3>
        {isAdmin && (
          <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-0.5" style={{ background: "#2D5A3D" }}>
            <Plus className="h-4 w-4" /> Log Activity
          </button>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center" style={{ border: "1px solid #E8E5E0" }}>
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" style={{ color: "#2D5A3D" }} />
          <p className="font-medium" style={{ color: "#2C3E50" }}>No activity logged yet</p>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>Track communications, meetings, status updates, and more.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: "#D5E5D5" }} />

          <div className="space-y-4">
            {activities.map((activity: any) => {
              const colors = getActivityColor(activity.activityType);
              return (
                <div key={activity.id} className="relative pl-14">
                  {/* Timeline dot */}
                  <div className="absolute left-4 top-4 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: colors.bg, border: `2px solid ${colors.border}` }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: colors.text }} />
                  </div>

                  <div className="bg-white rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.border}` }}>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: colors.bg, color: colors.text }}>
                            {getActivityIcon(activity.activityType)}
                            {activity.activityType}
                          </span>
                          <span className="text-xs" style={{ color: "#999999" }}>
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {formatDate(activity.activityDate)}
                          </span>
                        </div>
                        {isAdmin && (
                          <button onClick={() => onDelete(activity.id)} className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" style={{ color: "#C0714A" }} />
                          </button>
                        )}
                      </div>

                      <h4 className="font-semibold text-sm mt-2" style={{ color: "#2C3E50" }}>{activity.title}</h4>

                      {activity.description && (
                        <p className="text-sm mt-1" style={{ color: "#666666" }}>{activity.description}</p>
                      )}

                      {(activity.contactPerson || activity.contactDetails) && (
                        <div className="flex items-center gap-4 mt-2 pt-2" style={{ borderTop: "1px solid #E8E5E0" }}>
                          {activity.contactPerson && (
                            <span className="text-xs flex items-center gap-1" style={{ color: "#666666" }}>
                              <User className="h-3 w-3" /> {activity.contactPerson}
                            </span>
                          )}
                          {activity.contactDetails && (
                            <span className="text-xs flex items-center gap-1" style={{ color: "#666666" }}>
                              <Phone className="h-3 w-3" /> {activity.contactDetails}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payments Tab ──────────────────────────────────────────────────

function PaymentsTab({ payments, property, totalPaid, totalOutstanding, progress, nextPayment, onRecordPayment, onAddInstallment, isAdmin }: any) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg p-3" style={{ background: "#F8FAF8", border: "1px solid #D5E5D5" }}>
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#888888" }}>Total Price</div>
          <div className="font-currency text-lg font-bold mt-1" style={{ color: "#2C3E50" }}>{formatCurrency(property.totalPrice || "0", property.currency)}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "#F8FAF8", border: "1px solid #D5E5D5" }}>
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#888888" }}>Total Paid</div>
          <div className="font-currency text-lg font-bold mt-1" style={{ color: "#2D5A3D" }}>{formatCurrency(totalPaid, property.currency)}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "#F8FAF8", border: "1px solid #D5E5D5" }}>
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#888888" }}>Outstanding</div>
          <div className="font-currency text-lg font-bold mt-1" style={{ color: "#C0714A" }}>{formatCurrency(totalOutstanding, property.currency)}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "#F8FAF8", border: "1px solid #D5E5D5" }}>
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#888888" }}>Next Due</div>
          <div className="text-sm font-medium mt-1" style={{ color: "#2C3E50" }}>
            {nextPayment ? (
              <>
                <span className="font-currency font-bold">{formatCurrency(Number(nextPayment.amountDue) - Number(nextPayment.amountPaid), property.currency)}</span>
                <br />
                <span className="text-xs" style={{ color: "#666666" }}>{formatDate(nextPayment.dueDate)}</span>
              </>
            ) : "All paid"}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-lg p-4" style={{ border: "1px solid #E8E5E0" }}>
        <div className="flex justify-between text-sm mb-2">
          <span style={{ color: "#666666" }}>Payment Completion</span>
          <span className="font-currency font-semibold" style={{ color: "#2C3E50" }}>{progress}%</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "#EEF5EE" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "#2D5A3D" }} />
        </div>
      </div>

      {/* Actions */}
      {isAdmin && (
        <div className="flex gap-2">
          <button onClick={onAddInstallment} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-0.5" style={{ background: "#2D5A3D" }}>
            <Plus className="h-4 w-4" /> Add Installment
          </button>
        </div>
      )}

      {/* Payment Table */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: "#2D5A3D" }}>
                <th className="text-left px-4 py-3 text-xs font-medium text-white">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white">Label</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white">Amount Due</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white">Paid</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white">Balance</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-white">Status</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any, idx: number) => {
                const balance = Number(p.amountDue) - Number(p.amountPaid);
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #D5E5D5", background: idx % 2 === 0 ? "#FFFFFF" : "#F8FAF8" }}>
                    <td className="px-4 py-3 text-sm" style={{ color: "#2C3E50" }}>{p.installmentNumber}</td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: "#2C3E50" }}>{p.installmentLabel}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#666666" }}>{formatDate(p.dueDate)}</td>
                    <td className="px-4 py-3 text-sm text-right font-currency" style={{ color: "#2C3E50" }}>{formatCurrency(p.amountDue, property.currency)}</td>
                    <td className="px-4 py-3 text-sm text-right font-currency" style={{ color: "#2D5A3D" }}>{formatCurrency(p.amountPaid, property.currency)}</td>
                    <td className="px-4 py-3 text-sm text-right font-currency" style={{ color: balance > 0 ? "#C0714A" : "#2D5A3D" }}>{formatCurrency(balance, property.currency)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPaymentStatusBadgeClass(p.paymentStatus)}`}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isAdmin && p.paymentStatus !== "Paid" && (
                        <button
                          onClick={() => onRecordPayment(p)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-all hover:-translate-y-0.5"
                          style={{ background: "#C0714A" }}
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Contract Tab ──────────────────────────────────────────────────

function ContractTab({ contracts }: { contracts: any[] }) {
  if (contracts.length === 0) {
    return (
      <div className="bg-white rounded-lg p-12 text-center" style={{ border: "1px solid #E8E5E0" }}>
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" style={{ color: "#2D5A3D" }} />
        <p className="font-medium" style={{ color: "#2C3E50" }}>No contracts recorded</p>
        <p className="text-sm mt-1" style={{ color: "#666666" }}>Contract details will appear here once added.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {contracts.map((c) => (
        <div key={c.id} className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "#EEF5EE", color: "#2D5A3D" }}>{c.contractType}</span>
                {c.contractNumber && <span className="text-sm ml-3 font-currency" style={{ color: "#666666" }}>#{c.contractNumber}</span>}
              </div>
              <span className="text-sm" style={{ color: "#666666" }}>Signed: {formatDate(c.signingDate)}</span>
            </div>
            {c.parties && (
              <div className="mb-2">
                <div className="text-xs font-medium" style={{ color: "#666666" }}>Parties</div>
                <div className="text-sm" style={{ color: "#2C3E50" }}>{c.parties}</div>
              </div>
            )}
            {c.keyTerms && (
              <div className="mb-2">
                <div className="text-xs font-medium" style={{ color: "#666666" }}>Key Terms</div>
                <div className="text-sm" style={{ color: "#2C3E50" }}>{c.keyTerms}</div>
              </div>
            )}
            {c.penaltyClauses && (
              <div className="p-3 rounded-lg mt-2" style={{ background: "#FFF0E8", border: "1px solid #C0714A33" }}>
                <div className="text-xs font-medium mb-1" style={{ color: "#C0714A" }}>Penalty Clauses</div>
                <div className="text-sm" style={{ color: "#A8613F" }}>{c.penaltyClauses}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Documents Tab ──────────────────────────────────────────────────

function DocumentsTab({ docs, onUpload, onDelete, isAdmin }: { docs: any[]; onUpload: () => void; onDelete: (id: number) => void; isAdmin?: boolean }) {
  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={onUpload} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-0.5" style={{ background: "#2D5A3D" }}>
            <Upload className="h-4 w-4" /> Upload Document
          </button>
        </div>
      )}
      {docs.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center" style={{ border: "1px solid #E8E5E0" }}>
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-20" style={{ color: "#2D5A3D" }} />
          <p className="font-medium" style={{ color: "#2C3E50" }}>No documents uploaded</p>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>Upload contracts, receipts, and other files.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map((d) => (
            <div key={d.id} className="bg-white rounded-lg p-4 flex items-center gap-3" style={{ border: "1px solid #E8E5E0" }}>
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "#EEF5EE" }}>
                <FileText className="h-5 w-5" style={{ color: "#2D5A3D" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "#2C3E50" }}>{d.documentName}</div>
                <div className="text-xs" style={{ color: "#666666" }}>{d.documentType} &middot; {d.fileSizeKb ? `${d.fileSizeKb} KB` : ""}</div>
              </div>
              <div className="flex items-center gap-1">
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-gray-50">
                  <Download className="h-4 w-4" style={{ color: "#666666" }} />
                </a>
                {isAdmin && (
                  <button onClick={() => onDelete(d.id)} className="p-2 rounded-lg hover:bg-gray-50">
                    <Trash2 className="h-4 w-4" style={{ color: "#C0714A" }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modals ──────────────────────────────────────────────────

function RecordPaymentModal({ open, onClose, payment, currency, onSubmit, isLoading }: any) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    onSubmit({
      id: payment.id,
      amountPaid: amount,
      paymentDate: date,
      paymentMethod: method || undefined,
      paymentReference: reference || undefined,
    });
  };

  if (!payment) return null;
  const balance = Number(payment.amountDue) - Number(payment.amountPaid);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "#2C3E50" }}>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-lg" style={{ background: "#F8FAF8", border: "1px solid #D5E5D5" }}>
            <div className="text-xs" style={{ color: "#666666" }}>{payment.installmentLabel}</div>
            <div className="font-currency text-sm font-medium mt-1" style={{ color: "#2C3E50" }}>Balance: {formatCurrency(balance, currency)}</div>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Amount Paid *</label>
            <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={{ border: "1px solid #D5D0C8" }} placeholder="0.00" />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Payment Date *</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Payment Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }}>
              <option value="">Select method</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Reference Number</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-all hover:-translate-y-0.5" style={{ background: "#2D5A3D" }}>
              {isLoading ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddInstallmentModal({ open, onClose, propertyId, nextNumber, onSubmit, isLoading }: any) {
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amountDue, setAmountDue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      propertyId,
      installmentLabel: label,
      installmentNumber: nextNumber,
      dueDate,
      amountDue,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "#2C3E50" }}>Add Installment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Label *</label>
            <input type="text" required value={label} onChange={(e) => setLabel(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} placeholder="e.g., Installment 5" />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Due Date *</label>
            <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Amount Due *</label>
            <input type="number" step="0.01" required value={amountDue} onChange={(e) => setAmountDue(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={{ border: "1px solid #D5D0C8" }} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-all hover:-translate-y-0.5" style={{ background: "#2D5A3D" }}>
              {isLoading ? "Adding..." : "Add Installment"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UploadDocModal({ open, onClose, propertyId, onSubmit, isLoading }: any) {
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("Contract");
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      onSubmit({
        propertyId,
        documentName: docName,
        documentType: docType,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type,
        fileSizeKb: Math.round(file.size / 1024),
        tags: tags ? tags.split(",").map((t) => t.trim()) : undefined,
        notes: notes || undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "#2C3E50" }}>Upload Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
            style={{ borderColor: isDragging ? "#4A7C59" : "#D5D0C8", background: isDragging ? "#EEF5EE" : "#F8FAF8" }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm" style={{ color: "#666666" }}>{file ? file.name : "Drag & drop or click to browse"}</p>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Document Name *</label>
            <input type="text" required value={docName} onChange={(e) => setDocName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Type *</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }}>
              {["Contract", "Receipt", "Floor-Plan", "NOC", "Title-Deed", "Payment-Proof", "Correspondence", "Photo", "Other"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Tags (comma-separated)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} placeholder="e.g., important, 2024" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <button type="submit" disabled={isLoading || !file} className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-all hover:-translate-y-0.5" style={{ background: "#2D5A3D" }}>
              {isLoading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddActivityModal({ open, onClose, propertyId, onSubmit, isLoading }: any) {
  const [activityType, setActivityType] = useState("Note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0]);
  const [contactPerson, setContactPerson] = useState("");
  const [contactDetails, setContactDetails] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      propertyId,
      activityType,
      title,
      description: description || undefined,
      activityDate,
      contactPerson: contactPerson || undefined,
      contactDetails: contactDetails || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "#2C3E50" }}>Log Activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Activity Type *</label>
            <select required value={activityType} onChange={(e) => setActivityType(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }}>
              {["Note", "Communication", "Status Update", "Payment", "Meeting", "Inspection", "Document", "Sale", "Other"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Title *</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} placeholder="e.g., Called developer for update" />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} rows={3} placeholder="Details about this activity..." />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Date *</label>
            <input type="date" required value={activityDate} onChange={(e) => setActivityDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Contact Person</label>
            <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} placeholder="e.g., Ahmed - Sales Manager" />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Contact Details</label>
            <input type="text" value={contactDetails} onChange={(e) => setContactDetails(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} placeholder="e.g., +971 50 123 4567" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-all hover:-translate-y-0.5" style={{ background: "#2D5A3D" }}>
              {isLoading ? "Saving..." : "Log Activity"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
