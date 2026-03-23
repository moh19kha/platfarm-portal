import { trpc } from "@/lib/trpc";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Installment = {
  installmentLabel: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: string;
  amountPaid: string;
  paymentStatus: "Paid" | "Partially-Paid" | "Pending" | "Overdue";
  percentageOfTotal?: number;
};

export default function PropertyForm() {
  const params = useParams<{ id: string }>();
  const isEdit = Boolean(params.id);
  const propertyId = params.id ? Number(params.id) : null;
  const [, setLocation] = useLocation();

  const { data: existingProperty } = trpc.property.properties.getById.useQuery(
    { id: propertyId! },
    { enabled: !!propertyId }
  );
  const { data: existingPayments } = trpc.property.payments.byProperty.useQuery(
    { propertyId: propertyId! },
    { enabled: !!propertyId }
  );

  // Form state
  const [form, setForm] = useState({
    propertyName: "", developerName: "", projectName: "", country: "UAE" as "UAE" | "Egypt",
    city: "", district: "", fullAddress: "", latitude: "", longitude: "",
    unitType: "Apartment" as any, bedrooms: 0, bathrooms: 0, builtUpAreaSqm: "",
    plotAreaSqm: "", floorNumber: "", unitNumber: "", buildingName: "", viewType: "",
    furnishing: "" as any, parkingSpaces: 0, purchaseDate: "", expectedDelivery: "",
    actualDelivery: "", deliveryStatus: "Off-Plan" as any, totalPrice: "", currency: "AED" as "AED" | "EGP",
    currentMarketValue: "", valueLastUpdated: "", purpose: "" as any, notes: "", status: "Active" as any,
    // Purchase type fields
    purchaseType: "Direct" as "Direct" | "Secondary Market",
    originalContractValue: "", premiumPaid: "", sellerName: "", sellerContact: "",
    // Sale tracking fields
    saleDate: "", salePrice: "", buyerName: "", buyerContact: "", buyerEmail: "",
    premiumReceived: "", saleNotes: "",
  });

  const [installments, setInstallments] = useState<Installment[]>([]);
  const [contract, setContract] = useState({ contractType: "SPA" as any, contractNumber: "", signingDate: "", parties: "", keyTerms: "", penaltyClauses: "" });

  useEffect(() => {
    if (existingProperty) {
      setForm({
        propertyName: existingProperty.propertyName || "",
        developerName: existingProperty.developerName || "",
        projectName: existingProperty.projectName || "",
        country: existingProperty.country as any,
        city: existingProperty.city || "",
        district: existingProperty.district || "",
        fullAddress: existingProperty.fullAddress || "",
        latitude: existingProperty.latitude ? String(existingProperty.latitude) : "",
        longitude: existingProperty.longitude ? String(existingProperty.longitude) : "",
        unitType: existingProperty.unitType as any,
        bedrooms: existingProperty.bedrooms || 0,
        bathrooms: existingProperty.bathrooms || 0,
        builtUpAreaSqm: existingProperty.builtUpAreaSqm ? String(existingProperty.builtUpAreaSqm) : "",
        plotAreaSqm: existingProperty.plotAreaSqm ? String(existingProperty.plotAreaSqm) : "",
        floorNumber: existingProperty.floorNumber != null ? String(existingProperty.floorNumber) : "",
        unitNumber: existingProperty.unitNumber || "",
        buildingName: existingProperty.buildingName || "",
        viewType: existingProperty.viewType || "",
        furnishing: existingProperty.furnishing || "",
        parkingSpaces: existingProperty.parkingSpaces || 0,
        purchaseDate: existingProperty.purchaseDate || "",
        expectedDelivery: existingProperty.expectedDelivery || "",
        actualDelivery: existingProperty.actualDelivery || "",
        deliveryStatus: existingProperty.deliveryStatus as any,
        totalPrice: existingProperty.totalPrice ? String(existingProperty.totalPrice) : "",
        currency: existingProperty.currency as any,
        currentMarketValue: existingProperty.currentMarketValue ? String(existingProperty.currentMarketValue) : "",
        valueLastUpdated: existingProperty.valueLastUpdated || "",
        purpose: existingProperty.purpose || "",
        notes: existingProperty.notes || "",
        status: existingProperty.status as any,
        // Purchase type
        purchaseType: (existingProperty as any).purchaseType || "Direct",
        originalContractValue: (existingProperty as any).originalContractValue ? String((existingProperty as any).originalContractValue) : "",
        premiumPaid: (existingProperty as any).premiumPaid ? String((existingProperty as any).premiumPaid) : "",
        sellerName: (existingProperty as any).sellerName || "",
        sellerContact: (existingProperty as any).sellerContact || "",
        // Sale tracking
        saleDate: (existingProperty as any).saleDate || "",
        salePrice: (existingProperty as any).salePrice ? String((existingProperty as any).salePrice) : "",
        buyerName: (existingProperty as any).buyerName || "",
        buyerContact: (existingProperty as any).buyerContact || "",
        buyerEmail: (existingProperty as any).buyerEmail || "",
        premiumReceived: (existingProperty as any).premiumReceived ? String((existingProperty as any).premiumReceived) : "",
        saleNotes: (existingProperty as any).saleNotes || "",
      });
    }
  }, [existingProperty]);

  const createMut = trpc.property.properties.create.useMutation({
    onSuccess: (data) => { toast.success("Property created successfully"); setLocation(`/properties/${data.id}`); },
    onError: (err) => toast.error(err.message || "Failed to create property"),
  });

  const updateMut = trpc.property.properties.update.useMutation({
    onSuccess: () => { toast.success("Property updated successfully"); setLocation(`/properties/${propertyId}`); },
    onError: (err) => toast.error(err.message || "Failed to update property"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      ...form,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
      builtUpAreaSqm: form.builtUpAreaSqm ? Number(form.builtUpAreaSqm) : undefined,
      plotAreaSqm: form.plotAreaSqm ? Number(form.plotAreaSqm) : undefined,
      floorNumber: form.floorNumber ? Number(form.floorNumber) : undefined,
      parkingSpaces: Number(form.parkingSpaces) || 0,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      furnishing: form.furnishing || undefined,
      purpose: form.purpose || undefined,
      district: form.district || undefined,
      fullAddress: form.fullAddress || undefined,
      unitNumber: form.unitNumber || undefined,
      buildingName: form.buildingName || undefined,
      viewType: form.viewType || undefined,
      expectedDelivery: form.expectedDelivery || undefined,
      actualDelivery: form.actualDelivery || undefined,
      currentMarketValue: form.currentMarketValue || undefined,
      valueLastUpdated: form.valueLastUpdated || undefined,
      notes: form.notes || undefined,
      totalPrice: form.totalPrice || undefined,
      // Purchase type
      purchaseType: form.purchaseType,
      originalContractValue: form.purchaseType === "Secondary Market" && form.originalContractValue ? form.originalContractValue : undefined,
      premiumPaid: form.purchaseType === "Secondary Market" && form.premiumPaid ? form.premiumPaid : undefined,
      sellerName: form.purchaseType === "Secondary Market" && form.sellerName ? form.sellerName : undefined,
      sellerContact: form.purchaseType === "Secondary Market" && form.sellerContact ? form.sellerContact : undefined,
      // Sale tracking
      saleDate: form.status === "Sold" && form.saleDate ? form.saleDate : undefined,
      salePrice: form.status === "Sold" && form.salePrice ? form.salePrice : undefined,
      buyerName: form.status === "Sold" && form.buyerName ? form.buyerName : undefined,
      buyerContact: form.status === "Sold" && form.buyerContact ? form.buyerContact : undefined,
      buyerEmail: form.status === "Sold" && form.buyerEmail ? form.buyerEmail : undefined,
      premiumReceived: form.status === "Sold" && form.premiumReceived ? form.premiumReceived : undefined,
      saleNotes: form.status === "Sold" && form.saleNotes ? form.saleNotes : undefined,
    };

    if (isEdit && propertyId) {
      updateMut.mutate({ id: propertyId, ...data });
    } else {
      data.paymentSchedule = installments.length > 0 ? installments : undefined;
      data.contract = contract.signingDate ? contract : undefined;
      createMut.mutate(data);
    }
  };

  const addInstallment = () => {
    setInstallments([...installments, {
      installmentLabel: `Installment ${installments.length + 1}`,
      installmentNumber: installments.length + 1,
      dueDate: "", amountDue: "", amountPaid: "0", paymentStatus: "Pending",
    }]);
  };

  const removeInstallment = (idx: number) => {
    setInstallments(installments.filter((_, i) => i !== idx).map((inst, i) => ({ ...inst, installmentNumber: i + 1 })));
  };

  const updateInstallment = (idx: number, field: string, value: any) => {
    const updated = [...installments];
    (updated[idx] as any)[field] = value;
    setInstallments(updated);
  };

  const sqftValue = form.builtUpAreaSqm ? Math.round(Number(form.builtUpAreaSqm) * 10.7639) : "";

  const inputStyle = { border: "1px solid #D5D0C8", color: "#2C3E50" };
  const labelStyle = { color: "#2C3E50" };

  const SectionHeader = ({ title, color }: { title: string; color?: string }) => (
    <div className="px-5 py-3 -mx-5 -mt-1 mb-4 rounded-t-lg" style={{ background: color || "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
      <h3 className="font-semibold text-white text-sm">{title}</h3>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => setLocation(isEdit ? `/properties/${propertyId}` : "/properties")} className="flex items-center gap-2 text-sm font-medium" style={{ color: "#4A7C59" }}>
        <ArrowLeft className="h-4 w-4" /> {isEdit ? "Back to Property" : "Back to Properties"}
      </button>

      <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>{isEdit ? "Edit Property" : "Add New Property"}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Property Identity */}
        <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <SectionHeader title="Property Identity" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Property Name *</label>
              <input type="text" required value={form.propertyName} onChange={(e) => setForm({ ...form, propertyName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="e.g., Marina Heights Unit 1204" />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Developer *</label>
              <input type="text" required value={form.developerName} onChange={(e) => setForm({ ...form, developerName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="e.g., Aldar Properties" />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Project Name *</label>
              <input type="text" required value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="e.g., Saadiyat Reserve" />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Purpose</label>
              <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="">Select purpose</option>
                <option value="Primary Residence">Primary Residence</option>
                <option value="Investment">Investment</option>
                <option value="Holiday Home">Holiday Home</option>
                <option value="Rental">Rental</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="Active">Active</option>
                <option value="Sold">Sold</option>
                <option value="On-Hold">On Hold</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Location */}
        <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <SectionHeader title="Location" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Country *</label>
              <select required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="UAE">UAE</option>
                <option value="Egypt">Egypt</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>City *</label>
              <input type="text" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="e.g., Abu Dhabi" />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>District</label>
              <input type="text" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Full Address</label>
              <input type="text" value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Latitude</label>
              <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Longitude</label>
              <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Section 3: Unit Specifications */}
        <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <SectionHeader title="Unit Specifications" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Unit Type *</label>
              <select required value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                {["Apartment", "Villa", "Townhouse", "Twin House", "Duplex", "Chalet", "Penthouse", "Studio", "Land"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Bedrooms</label>
              <input type="number" min={0} value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Bathrooms</label>
              <input type="number" min={0} value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Built-up Area (sqm)</label>
              <input type="number" step="0.01" value={form.builtUpAreaSqm} onChange={(e) => setForm({ ...form, builtUpAreaSqm: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              {sqftValue && <div className="text-xs mt-1 font-currency" style={{ color: "#666666" }}>{sqftValue} sqft</div>}
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Plot Area (sqm)</label>
              <input type="number" step="0.01" value={form.plotAreaSqm} onChange={(e) => setForm({ ...form, plotAreaSqm: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Floor Number</label>
              <input type="number" value={form.floorNumber} onChange={(e) => setForm({ ...form, floorNumber: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Unit Number</label>
              <input type="text" value={form.unitNumber} onChange={(e) => setForm({ ...form, unitNumber: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Building Name</label>
              <input type="text" value={form.buildingName} onChange={(e) => setForm({ ...form, buildingName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>View Type</label>
              <input type="text" value={form.viewType} onChange={(e) => setForm({ ...form, viewType: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="e.g., Sea View" />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Furnishing</label>
              <select value={form.furnishing} onChange={(e) => setForm({ ...form, furnishing: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="">Select</option>
                <option value="Unfurnished">Unfurnished</option>
                <option value="Semi-Furnished">Semi-Furnished</option>
                <option value="Fully-Furnished">Fully-Furnished</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Parking Spaces</label>
              <input type="number" min={0} value={form.parkingSpaces} onChange={(e) => setForm({ ...form, parkingSpaces: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Section 4: Purchase & Delivery */}
        <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <SectionHeader title="Purchase & Delivery" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Purchase Date *</label>
              <input type="date" required value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Total Price</label>
              <input type="number" step="0.01" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Currency *</label>
              <select required value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="AED">AED</option>
                <option value="EGP">EGP</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Delivery Status *</label>
              <select required value={form.deliveryStatus} onChange={(e) => setForm({ ...form, deliveryStatus: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                {["Off-Plan", "Under-Construction", "Delivered", "Handed-Over"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Expected Delivery</label>
              <input type="date" value={form.expectedDelivery} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Actual Delivery</label>
              <input type="date" value={form.actualDelivery} onChange={(e) => setForm({ ...form, actualDelivery: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Purchase Type</label>
              <select value={form.purchaseType} onChange={(e) => setForm({ ...form, purchaseType: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="Direct">Direct from Developer</option>
                <option value="Secondary Market">Secondary Market</option>
              </select>
            </div>
          </div>
          {/* Market Value Sub-section */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px dashed #D5D0C8" }}>
            <div className="text-sm font-semibold mb-3" style={{ color: "#4A7C59" }}>Current Market Valuation</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Current Market Value ({form.currency})</label>
                <input type="number" step="0.01" value={form.currentMarketValue} onChange={(e) => setForm({ ...form, currentMarketValue: e.target.value, valueLastUpdated: new Date().toISOString().split('T')[0] })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={inputStyle} placeholder="Enter current estimated market value" />
                {form.totalPrice && form.currentMarketValue && (() => {
                  const gain = Number(form.currentMarketValue) - Number(form.totalPrice);
                  const pct = ((gain / Number(form.totalPrice)) * 100).toFixed(1);
                  const isPositive = gain >= 0;
                  return <div className="text-xs mt-1 font-currency" style={{ color: isPositive ? '#2D5A3D' : '#DC2626' }}>{isPositive ? '+' : ''}{Number(pct)}% {isPositive ? 'gain' : 'loss'} vs. purchase price</div>;
                })()}
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Value Last Updated</label>
                <input type="date" value={form.valueLastUpdated} onChange={(e) => setForm({ ...form, valueLastUpdated: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                <div className="text-xs mt-1" style={{ color: '#666666' }}>Auto-set when you change market value</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4b: Secondary Market Details (conditional) */}
        {form.purchaseType === "Secondary Market" && (
          <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #F0D5C4" }}>
            <SectionHeader title="Secondary Market Details" color="linear-gradient(to right, #C0714A, #A8613F)" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Original Contract Value</label>
                <input type="number" step="0.01" value={form.originalContractValue} onChange={(e) => setForm({ ...form, originalContractValue: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={inputStyle} placeholder="Original developer price" />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Premium Paid</label>
                <input type="number" step="0.01" value={form.premiumPaid} onChange={(e) => setForm({ ...form, premiumPaid: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={inputStyle} placeholder="Amount above original contract" />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Seller Name</label>
                <input type="text" value={form.sellerName} onChange={(e) => setForm({ ...form, sellerName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="Previous owner name" />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Seller Contact</label>
                <input type="text" value={form.sellerContact} onChange={(e) => setForm({ ...form, sellerContact: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="Phone or email" />
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: "#FEF9F5", border: "1px solid #F0D5C4", color: "#A8613F" }}>
              Total Purchase = Original Contract Value + Premium. The Total Price field above should reflect the full amount you paid.
            </div>
          </div>
        )}

        {/* Section 5: Valuation */}
        <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <SectionHeader title="Valuation" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Current Market Value</label>
              <input type="number" step="0.01" value={form.currentMarketValue} onChange={(e) => setForm({ ...form, currentMarketValue: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium" style={labelStyle}>Last Assessed Date</label>
              <input type="date" value={form.valueLastUpdated} onChange={(e) => setForm({ ...form, valueLastUpdated: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Section 5b: Sale Details (conditional - only when status is Sold) */}
        {form.status === "Sold" && (
          <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #D5E5D5" }}>
            <SectionHeader title="Sale Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Sale Date</label>
                <input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Sale Price</label>
                <input type="number" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Buyer Name</label>
                <input type="text" value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Buyer Contact</label>
                <input type="text" value={form.buyerContact} onChange={(e) => setForm({ ...form, buyerContact: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Buyer Email</label>
                <input type="email" value={form.buyerEmail} onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Premium Received</label>
                <input type="number" step="0.01" value={form.premiumReceived} onChange={(e) => setForm({ ...form, premiumReceived: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={inputStyle} placeholder="Profit above your total cost" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium" style={labelStyle}>Sale Notes</label>
                <textarea value={form.saleNotes} onChange={(e) => setForm({ ...form, saleNotes: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} rows={2} placeholder="Any notes about the sale..." />
              </div>
            </div>
            {form.salePrice && form.totalPrice && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: Number(form.salePrice) >= Number(form.totalPrice) ? "#EEF5EE" : "#FFF0E8", border: `1px solid ${Number(form.salePrice) >= Number(form.totalPrice) ? "#C5DDC5" : "#F0D5C4"}` }}>
                <span className="text-sm font-medium" style={{ color: Number(form.salePrice) >= Number(form.totalPrice) ? "#2D5A3D" : "#C0714A" }}>
                  {Number(form.salePrice) >= Number(form.totalPrice) ? "Profit" : "Loss"}: <span className="font-currency font-bold">{form.currency} {Math.abs(Number(form.salePrice) - Number(form.totalPrice)).toLocaleString()}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Section 6: Payment Schedule Builder (only for new properties) */}
        {!isEdit && (
          <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
            <SectionHeader title="Payment Schedule" />
            <div className="space-y-3">
              {installments.map((inst, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-3 rounded-lg" style={{ background: "#F8FAF8" }}>
                  <div>
                    <label className="text-xs font-medium" style={labelStyle}>Label</label>
                    <input type="text" value={inst.installmentLabel} onChange={(e) => updateInstallment(idx, "installmentLabel", e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={labelStyle}>Due Date</label>
                    <input type="date" value={inst.dueDate} onChange={(e) => updateInstallment(idx, "dueDate", e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={labelStyle}>Amount</label>
                    <input type="number" step="0.01" value={inst.amountDue} onChange={(e) => updateInstallment(idx, "amountDue", e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={labelStyle}>Status</label>
                    <select value={inst.paymentStatus} onChange={(e) => updateInstallment(idx, "paymentStatus", e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Partially-Paid">Partially Paid</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={() => removeInstallment(idx)} className="p-2 rounded-lg hover:bg-red-50">
                      <Trash2 className="h-4 w-4" style={{ color: "#C0714A" }} />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addInstallment} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ border: "1px solid #D5D0C8", color: "#4A7C59" }}>
                <Plus className="h-4 w-4" /> Add Installment
              </button>
            </div>
          </div>
        )}

        {/* Section 7: Contract (only for new properties) */}
        {!isEdit && (
          <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
            <SectionHeader title="Contract Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Contract Type</label>
                <select value={contract.contractType} onChange={(e) => setContract({ ...contract, contractType: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                  {["SPA", "MOU", "Reservation", "Amendment", "Addendum"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Contract Number</label>
                <input type="text" value={contract.contractNumber} onChange={(e) => setContract({ ...contract, contractNumber: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Signing Date</label>
                <input type="date" value={contract.signingDate} onChange={(e) => setContract({ ...contract, signingDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium" style={labelStyle}>Parties</label>
                <input type="text" value={contract.parties} onChange={(e) => setContract({ ...contract, parties: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium" style={labelStyle}>Key Terms</label>
                <textarea value={contract.keyTerms} onChange={(e) => setContract({ ...contract, keyTerms: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} rows={3} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium" style={labelStyle}>Penalty Clauses</label>
                <textarea value={contract.penaltyClauses} onChange={(e) => setContract({ ...contract, penaltyClauses: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} rows={3} />
              </div>
            </div>
          </div>
        )}

        {/* Section 8: Notes */}
        <div className="bg-white rounded-lg p-5 overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <SectionHeader title="Notes" />
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} rows={4} placeholder="Any additional notes..." />
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pb-8">
          <Button type="button" variant="outline" onClick={() => setLocation(isEdit ? `/properties/${propertyId}` : "/properties")}>
            Cancel
          </Button>
          <button
            type="submit"
            disabled={createMut.isPending || updateMut.isPending}
            className="px-8 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
            style={{ background: "#2D5A3D" }}
          >
            {createMut.isPending || updateMut.isPending ? "Saving..." : isEdit ? "Update Property" : "Create Property"}
          </button>
        </div>
      </form>
    </div>
  );
}
