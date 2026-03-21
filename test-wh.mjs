import axios from "axios";

const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = "Platfarm@2025";

async function jsonrpc(url, method, params) {
  const res = await axios.post(url, { jsonrpc: "2.0", method: "call", params, id: 1 });
  if (res.data.error) throw new Error(JSON.stringify(res.data.error));
  return res.data.result;
}

// Get uid
const uid = await jsonrpc(`${ODOO_URL}/web/session/authenticate`, "call", {
  db: ODOO_DB, login: ODOO_USER, password: ODOO_PASSWORD
}).then(r => r.uid);
console.log("UID:", uid);

// Check purchase.order fields
const pos = await jsonrpc(`${ODOO_URL}/jsonrpc`, "call", {
  service: "object", method: "execute_kw",
  args: [ODOO_DB, uid, ODOO_PASSWORD, "purchase.order", "search_read",
    [[["state", "in", ["purchase", "done"]]]],
    { fields: ["id", "name", "warehouse_id", "picking_type_id"], limit: 5 }
  ]
});
console.log("Sample POs:");
for (const po of pos) {
  console.log(`  ${po.name}: warehouse_id=${JSON.stringify(po.warehouse_id)}, picking_type_id=${JSON.stringify(po.picking_type_id)}`);
}
