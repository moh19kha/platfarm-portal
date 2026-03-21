import axios from "axios";

const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = "Platfarm@2025";

const client = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

async function getUid() {
  const res = await client.post("/jsonrpc", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}],
    },
  });
  return res.data.result;
}

async function searchRead(uid, model, domain, fields, limit = 500) {
  const res = await client.post("/jsonrpc", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [ODOO_DB, uid, ODOO_PASSWORD, model, "search_read", [domain], {
        fields,
        limit,
        context: { allowed_company_ids: [1, 2, 3, 4, 5] },
      }],
    },
  });
  if (res.data.error) {
    console.error("Error:", res.data.error.data.message);
    return [];
  }
  return res.data.result;
}

const uid = await getUid();

// 1. Check what x_studio_source values exist on stock.picking for Egypt companies (id=3)
console.log("=== x_studio_source values on stock.picking (company_id=3, incoming, done) ===");
const pickings = await searchRead(uid, "stock.picking", [
  ["picking_type_code", "=", "incoming"],
  ["state", "=", "done"],
  ["company_id", "=", 3],
], ["name", "x_studio_source", "x_studio_purchasing_unit"], 500);

const sourceSet = new Set();
const puSet = new Set();
for (const p of pickings) {
  if (p.x_studio_source) sourceSet.add(p.x_studio_source);
  if (p.x_studio_purchasing_unit) puSet.add(p.x_studio_purchasing_unit);
}
console.log("Unique x_studio_source values:", [...sourceSet]);
console.log("Unique x_studio_purchasing_unit values:", [...puSet]);
console.log(`Total pickings: ${pickings.length}`);

// 2. Check if x_studio_source is a selection field (has predefined options)
console.log("\n=== Checking x_studio_source field type ===");
try {
  const fieldInfo = await client.post("/jsonrpc", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [ODOO_DB, uid, ODOO_PASSWORD, "stock.picking", "fields_get", [["x_studio_source", "x_studio_purchasing_unit"]], {
        context: { allowed_company_ids: [1, 2, 3, 4, 5] },
      }],
    },
  });
  if (fieldInfo.data.error) {
    console.error("Error:", fieldInfo.data.error.data.message);
  } else {
    const fields = fieldInfo.data.result;
    for (const [name, info] of Object.entries(fields)) {
      console.log(`\nField: ${name}`);
      console.log(`  Type: ${info.type}`);
      console.log(`  String: ${info.string}`);
      if (info.selection) {
        console.log(`  Selection options:`, info.selection);
      }
      if (info.relation) {
        console.log(`  Relation: ${info.relation}`);
      }
    }
  }
} catch (e) {
  console.error("Error fetching field info:", e.message);
}

// 3. Also check on purchase.order
console.log("\n=== Checking purchase.order for source-related fields ===");
try {
  const poFieldInfo = await client.post("/jsonrpc", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [ODOO_DB, uid, ODOO_PASSWORD, "purchase.order", "fields_get", [], {
        context: { allowed_company_ids: [1, 2, 3, 4, 5] },
        attributes: ["string", "type", "selection"],
      }],
    },
  });
  if (poFieldInfo.data.error) {
    console.error("Error:", poFieldInfo.data.error.data.message);
  } else {
    const fields = poFieldInfo.data.result;
    // Find source-related fields
    for (const [name, info] of Object.entries(fields)) {
      if (name.includes("source") || name.includes("purchasing_unit") || name.includes("location")) {
        console.log(`  ${name}: type=${info.type}, label="${info.string}"${info.selection ? `, options=${JSON.stringify(info.selection)}` : ""}`);
      }
    }
  }
} catch (e) {
  console.error("Error:", e.message);
}
