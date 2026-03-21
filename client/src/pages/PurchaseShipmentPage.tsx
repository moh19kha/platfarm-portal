// Standalone page for viewing a Purchase Shipment in a new tab (via /purchase/:id)
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { OdooShipDetail } from "./OdooShipDetail";

export default function PurchaseShipmentPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const shipmentId = Number(params.id);

  // Fetch shipment name for dynamic tab title
  const { data: shipment } = trpc.shipments.getById.useQuery(
    { id: shipmentId },
    { enabled: !!shipmentId && !isNaN(shipmentId), staleTime: 60_000 }
  );

  useEffect(() => {
    if (shipment?.name) {
      document.title = `${shipment.name} - Platfarm`;
    } else {
      document.title = "Purchase Shipment - Platfarm";
    }
    return () => { document.title = "Platfarm"; };
  }, [shipment?.name]);

  if (!shipmentId || isNaN(shipmentId)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
        <h2>Invalid shipment ID</h2>
        <button onClick={() => navigate("/")} style={{ marginTop: 12, cursor: "pointer" }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const handleNavigateToShipment = (
    type: "purchase" | "sales",
    nameOrId: string,
  ) => {
    // Open linked shipments in a new tab too
    const lookupEndpoint = type === "purchase"
      ? "shipments.lookupByName"
      : "salesShipments.lookupByName";
    // tRPC uses superjson transformer, so input must be wrapped in { json: ... }
    const input = JSON.stringify({ json: { name: nameOrId } });
    fetch(`/api/trpc/${lookupEndpoint}?input=${encodeURIComponent(input)}`)
      .then(res => res.json())
      .then(json => {
        const id = json?.result?.data?.json?.id;
        if (id) {
          window.open(`/${type}/${id}`, "_blank");
        } else {
          console.error("Linked shipment not found:", nameOrId, json);
        }
      })
      .catch(err => console.error("Failed to navigate to linked shipment:", err));
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "12px 16px" }}>
      <OdooShipDetail
        shipmentId={shipmentId}
        onBack={() => navigate("/")}
        onNavigateToShipment={handleNavigateToShipment}
      />
    </div>
  );
}
