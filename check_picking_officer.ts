import { executeKw } from "./server/odoo.js";

async function main() {
  // Check if stock.picking has x_studio_procurement_officer
  try {
    const pickings = await executeKw<any[]>("stock.picking", "search_read", 
      [[["picking_type_code", "=", "incoming"], ["company_id", "in", [3, 4, 5]]]],
      {
        fields: ["id", "name", "company_id", "x_studio_procurement_officer"],
        limit: 5,
        order: "id desc",
      }
    );
    console.log("Field exists on stock.picking! Sample data:");
    console.log(JSON.stringify(pickings, null, 2));
  } catch (e: any) {
    console.log("Error (field may not exist):", e.message);
  }
}

main().catch(e => console.error("Fatal:", e.message));
