import axios from 'axios';

const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = "Platfarm@2025";

const client = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

// Authenticate
const authRes = await client.post("/jsonrpc", {
  jsonrpc: "2.0", method: "call", id: 1,
  params: {
    service: "common", method: "authenticate",
    args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}]
  }
});
const uid = authRes.data.result;
console.log("UID:", uid);

// Search for CWDAK pickings
const res = await client.post("/jsonrpc", {
  jsonrpc: "2.0", method: "call", id: 2,
  params: {
    service: "object", method: "execute_kw",
    args: [
      ODOO_DB, uid, ODOO_PASSWORD,
      "stock.picking", "search_read",
      [[
        ["name", "like", "CWDAK"],
        ["state", "=", "done"],
        ["picking_type_code", "=", "incoming"],
      ]],
      {
        fields: ["name", "company_id", "date_done", "x_studio_loading_datetime", "scheduled_date", "x_studio_source", "x_studio_net_weight_in_tons"],
        limit: 10,
        order: "date_done desc",
      }
    ]
  }
});

const records = res.data.result;
console.log(`\nFound ${records.length} CWDAK incoming done pickings:\n`);
for (const r of records) {
  console.log(`${r.name} | company_id=${JSON.stringify(r.company_id)} | date_done=${r.date_done} | loading_dt=${r.x_studio_loading_datetime} | scheduled=${r.scheduled_date} | source=${r.x_studio_source} | tons=${r.x_studio_net_weight_in_tons}`);
}
