import axios from "axios";

const url = "https://platfrm.odoo.com";
const db = "platfrm";
const login = "aiagent@gmail.com";
const pw = "12345";

async function main() {
  const authRes = await axios.post(url + "/jsonrpc", {
    jsonrpc: "2.0", method: "call", id: 1,
    params: { service: "common", method: "authenticate", args: [db, login, pw, {}] }
  });
  const uid = authRes.data.result;

  // Get a picking for National Company (partner_id=642) with agreed_product_price_per_unit
  const pickings = await axios.post(url + "/jsonrpc", {
    jsonrpc: "2.0", method: "call", id: 2,
    params: {
      service: "object", method: "execute_kw",
      args: [db, uid, pw, "stock.picking", "search_read",
        [[["partner_id", "=", 642], ["picking_type_code", "=", "incoming"]]],
        { fields: ["id", "name", "origin", "partner_id", "agreed_product_price_per_unit", "x_studio_net_weight_in_tons", "move_ids", "purchase_id"], limit: 3, order: "id desc" }
      ]
    }
  });
  
  console.log("=== National Company Pickings ===");
  for (const p of pickings.data.result) {
    console.log(`Picking ${p.name}: price=${p.agreed_product_price_per_unit}, weight=${p.x_studio_net_weight_in_tons}t, origin=${p.origin}, purchase_id=${JSON.stringify(p.purchase_id)}`);
    
    // Get the stock.move for this picking
    if (p.move_ids?.length) {
      const moves = await axios.post(url + "/jsonrpc", {
        jsonrpc: "2.0", method: "call", id: 3,
        params: {
          service: "object", method: "execute_kw",
          args: [db, uid, pw, "stock.move", "search_read",
            [[["id", "in", p.move_ids.slice(0, 2)]]],
            { fields: ["id", "product_id", "product_uom", "product_uom_qty", "quantity", "price_unit"] }
          ]
        }
      });
      for (const m of moves.data.result) {
        console.log(`  Move: product=${JSON.stringify(m.product_id)}, uom=${JSON.stringify(m.product_uom)}, qty=${m.product_uom_qty}, done_qty=${m.quantity}, price_unit=${m.price_unit}`);
      }
    }
  }

  // Same for Ali Gomaa (partner_id=1010)
  const pickings2 = await axios.post(url + "/jsonrpc", {
    jsonrpc: "2.0", method: "call", id: 4,
    params: {
      service: "object", method: "execute_kw",
      args: [db, uid, pw, "stock.picking", "search_read",
        [[["partner_id", "=", 1010], ["picking_type_code", "=", "incoming"]]],
        { fields: ["id", "name", "origin", "partner_id", "agreed_product_price_per_unit", "x_studio_net_weight_in_tons", "move_ids", "purchase_id"], limit: 3, order: "id desc" }
      ]
    }
  });
  
  console.log("\n=== Ali Gomaa Pickings ===");
  for (const p of pickings2.data.result) {
    console.log(`Picking ${p.name}: price=${p.agreed_product_price_per_unit}, weight=${p.x_studio_net_weight_in_tons}t, origin=${p.origin}, purchase_id=${JSON.stringify(p.purchase_id)}`);
    
    if (p.move_ids?.length) {
      const moves = await axios.post(url + "/jsonrpc", {
        jsonrpc: "2.0", method: "call", id: 5,
        params: {
          service: "object", method: "execute_kw",
          args: [db, uid, pw, "stock.move", "search_read",
            [[["id", "in", p.move_ids.slice(0, 2)]]],
            { fields: ["id", "product_id", "product_uom", "product_uom_qty", "quantity", "price_unit"] }
          ]
        }
      });
      for (const m of moves.data.result) {
        console.log(`  Move: product=${JSON.stringify(m.product_id)}, uom=${JSON.stringify(m.product_uom)}, qty=${m.product_uom_qty}, done_qty=${m.quantity}, price_unit=${m.price_unit}`);
      }
    }
  }
}

main().catch(e => console.error(e.message));
