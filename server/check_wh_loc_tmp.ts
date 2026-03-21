import { executeKw } from "./odoo";

async function main() {
  // Check location_dest_id and warehouse fields on stock.picking receipts
  const pickings = await executeKw<any[]>("stock.picking", "search_read",
    [[["picking_type_code", "=", "incoming"], ["state", "=", "done"]]],
    { fields: ["name", "location_dest_id", "picking_type_id"], limit: 20 }
  );
  console.log("Sample pickings with location/warehouse fields:");
  for (const p of pickings.slice(0, 5)) {
    console.log(JSON.stringify({
      name: p.name,
      location_dest_id: p.location_dest_id,
      picking_type_id: p.picking_type_id,
      x_studio_warehouse: p.x_studio_warehouse,
    }));
  }

  // Get all unique location_dest_id values
  const allPickings = await executeKw<any[]>("stock.picking", "search_read",
    [[["picking_type_code", "=", "incoming"], ["state", "=", "done"]]],
    { fields: ["location_dest_id", "picking_type_id"], limit: 2000 }
  );

  const locations = new Map<number, string>();
  const pickingTypes = new Map<number, string>();
  for (const p of allPickings) {
    if (p.location_dest_id) locations.set(p.location_dest_id[0], p.location_dest_id[1]);
    if (p.picking_type_id) pickingTypes.set(p.picking_type_id[0], p.picking_type_id[1]);
  }

  console.log("\nAll unique destination locations:");
  for (const [id, name] of locations) console.log(`  ${id}: ${name}`);

  console.log("\nAll unique picking types:");
  for (const [id, name] of pickingTypes) console.log(`  ${id}: ${name}`);

  // Also check stock.warehouse
  const warehouses = await executeKw<any[]>("stock.warehouse", "search_read",
    [[]],
    { fields: ["id", "name", "code", "lot_stock_id"], limit: 50 }
  );
  console.log("\nWarehouses:");
  for (const w of warehouses) console.log(JSON.stringify(w));
}

main().catch(console.error);
