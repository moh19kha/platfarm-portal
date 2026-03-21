import axios from "axios";

const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = "Platfarm@2025";

async function jsonrpc(url, method, params) {
  const res = await axios.post(url, { jsonrpc: "2.0", method: "call", params, id: 1 });
  if (res.data.error) throw new Error(JSON.stringify(res.data.error.message));
  return res.data.result;
}

const uid = await jsonrpc(`${ODOO_URL}/web/session/authenticate`, "call", {
  db: ODOO_DB, login: ODOO_USER, password: ODOO_PASSWORD
}).then(r => r.uid);

// Check picking_type_id on purchase.order — this has warehouse_id
const pos = await jsonrpc(`${ODOO_URL}/jsonrpc`, "call", {
  service: "object", method: "execute_kw",
  args: [ODOO_DB, uid, ODOO_PASSWORD, "purchase.order", "search_read",
    [[["state", "in", ["purchase", "done"]]]],
    { fields: ["id", "name", "picking_type_id"], limit: 5 }
  ]
});
console.log("POs with picking_type_id:");
for (const po of pos) {
  console.log(`  ${po.name}: picking_type_id=${JSON.stringify(po.picking_type_id)}`);
}

// Now check stock.picking.type for warehouse_id
const ptIds = [...new Set(pos.map(p => p.picking_type_id ? p.picking_type_id[0] : 0).filter(Boolean))];
if (ptIds.length > 0) {
  const pts = await jsonrpc(`${ODOO_URL}/jsonrpc`, "call", {
    service: "object", method: "execute_kw",
    args: [ODOO_DB, uid, ODOO_PASSWORD, "stock.picking.type", "search_read",
      [[["id", "in", ptIds]]],
      { fields: ["id", "name", "warehouse_id", "default_location_dest_id"], limit: 20 }
    ]
  });
  console.log("\nstock.picking.type details:");
  for (const pt of pts) {
    console.log(`  ${pt.name}: warehouse_id=${JSON.stringify(pt.warehouse_id)}, default_loc_dest=${JSON.stringify(pt.default_location_dest_id)}`);
  }

  // Now fetch the warehouses to get their names
  const whIds = [...new Set(pts.map(p => p.warehouse_id ? p.warehouse_id[0] : 0).filter(Boolean))];
  if (whIds.length > 0) {
    const whs = await jsonrpc(`${ODOO_URL}/jsonrpc`, "call", {
      service: "object", method: "execute_kw",
      args: [ODOO_DB, uid, ODOO_PASSWORD, "stock.warehouse", "search_read",
        [[["id", "in", whIds]]],
        { fields: ["id", "name", "code"], limit: 20 }
      ]
    });
    console.log("\nWarehouses:");
    for (const wh of whs) {
      console.log(`  id=${wh.id}: name="${wh.name}", code="${wh.code}"`);
    }
  }

  // Also fetch the locations
  const locIds = [...new Set(pts.map(p => p.default_location_dest_id ? p.default_location_dest_id[0] : 0).filter(Boolean))];
  if (locIds.length > 0) {
    const locs = await jsonrpc(`${ODOO_URL}/jsonrpc`, "call", {
      service: "object", method: "execute_kw",
      args: [ODOO_DB, uid, ODOO_PASSWORD, "stock.location", "search_read",
        [[["id", "in", locIds]]],
        { fields: ["id", "name", "complete_name", "warehouse_id"], limit: 20 }
      ]
    });
    console.log("\nLocations (from picking type dest):");
    for (const loc of locs) {
      console.log(`  id=${loc.id}: name="${loc.name}", complete_name="${loc.complete_name}", warehouse_id=${JSON.stringify(loc.warehouse_id)}`);
    }
  }
}
