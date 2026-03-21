/**
 * Discover Odoo warehouse, location, and picking type data for internal transfers.
 * Run: node server/discover-transfer-data.mjs
 */
import axios from "axios";

const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = "Platfarm@2025";
const ALLOWED_COMPANY_IDS = [1, 2, 3, 4, 5];

const client = axios.create({ baseURL: ODOO_URL, headers: { "Content-Type": "application/json" }, timeout: 60000 });

async function getUid() {
  const res = await client.post("/jsonrpc", {
    jsonrpc: "2.0", method: "call",
    params: { service: "common", method: "login", args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD] }
  });
  return res.data.result;
}

async function executeKw(model, method, args, kwargs = {}) {
  const uid = await getUid();
  const res = await client.post("/jsonrpc", {
    jsonrpc: "2.0", method: "call",
    params: {
      service: "object", method: "execute_kw",
      args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, {
        ...kwargs,
        context: { ...(kwargs.context || {}), allowed_company_ids: ALLOWED_COMPANY_IDS }
      }]
    }
  });
  if (res.data.error) throw new Error(res.data.error.data.message);
  return res.data.result;
}

async function main() {
  console.log("=== WAREHOUSES ===");
  const warehouses = await executeKw("stock.warehouse", "search_read", [[]], {
    fields: ["id", "name", "code", "company_id", "lot_stock_id", "int_type_id"]
  });
  for (const w of warehouses) {
    console.log(`  WH ${w.id}: ${w.name} (${w.code}) company=${JSON.stringify(w.company_id)} lot_stock=${JSON.stringify(w.lot_stock_id)} int_type=${JSON.stringify(w.int_type_id)}`);
  }

  console.log("\n=== INTERNAL TRANSFER PICKING TYPES ===");
  const pickingTypes = await executeKw("stock.picking.type", "search_read", [[["code", "=", "internal"]]], {
    fields: ["id", "name", "code", "company_id", "warehouse_id", "default_location_src_id", "default_location_dest_id"]
  });
  for (const pt of pickingTypes) {
    console.log(`  PT ${pt.id}: ${pt.name} code=${pt.code} company=${JSON.stringify(pt.company_id)} warehouse=${JSON.stringify(pt.warehouse_id)} src=${JSON.stringify(pt.default_location_src_id)} dest=${JSON.stringify(pt.default_location_dest_id)}`);
  }

  console.log("\n=== STOCK LOCATIONS (internal, with 'Dakhla' or 'Sokhna' or 'MWCP' or 'CPDAK' or 'Finished') ===");
  const locations = await executeKw("stock.location", "search_read", [[["usage", "=", "internal"]]], {
    fields: ["id", "name", "complete_name", "warehouse_id", "company_id", "location_id"],
    order: "complete_name asc"
  });
  for (const l of locations) {
    const cn = l.complete_name || "";
    if (cn.toLowerCase().includes("dakhla") || cn.toLowerCase().includes("sokhna") || cn.toLowerCase().includes("mwcp") || cn.toLowerCase().includes("cpdak") || cn.toLowerCase().includes("finished") || cn.toLowerCase().includes("cwdak")) {
      console.log(`  LOC ${l.id}: ${l.complete_name} warehouse=${JSON.stringify(l.warehouse_id)} company=${JSON.stringify(l.company_id)}`);
    }
  }

  console.log("\n=== ALL STOCK LOCATIONS ===");
  for (const l of locations) {
    console.log(`  LOC ${l.id}: ${l.complete_name} warehouse=${JSON.stringify(l.warehouse_id)} company=${JSON.stringify(l.company_id)}`);
  }

  console.log("\n=== SAMPLE PRODUCTS (first 10) ===");
  const products = await executeKw("product.product", "search_read", [[["type", "=", "product"]]], {
    fields: ["id", "name", "display_name", "uom_id", "type"],
    limit: 10, order: "name asc"
  });
  for (const p of products) {
    console.log(`  PROD ${p.id}: ${p.display_name} uom=${JSON.stringify(p.uom_id)} type=${p.type}`);
  }
}

main().catch(e => console.error(e));
