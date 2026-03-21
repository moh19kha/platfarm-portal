import axios from 'axios';

const url = 'https://odoo.platfarm.io';
const db = 'odoo';

async function run() {
  const auth = await axios.post(url + '/web/session/authenticate', {
    jsonrpc: '2.0', method: 'call', id: 1,
    params: { db, login: 'aiagent', password: 'Platfarm@2025' }
  });
  const cookie = auth.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  const ctx = { allowed_company_ids: [1,2,3,5] };

  // 1. Check stock.move for move_id 16453 (Ali Gomaa's picking)
  console.log("=== STOCK.MOVE 16453 (Ali Gomaa) ===");
  const moves = await axios.post(url + '/web/dataset/call_kw', {
    jsonrpc: '2.0', method: 'call', id: 2,
    params: {
      model: 'stock.move', method: 'search_read',
      args: [[['id', '=', 16453]]],
      kwargs: { fields: [], limit: 1, context: ctx }
    }
  }, { headers: { Cookie: cookie } });
  const move = moves.data.result[0];
  if (move) {
    const pop = {};
    for (const [k, v] of Object.entries(move)) {
      if (v !== false && v !== '' && v !== null && v !== 0 && JSON.stringify(v) !== '[]') {
        pop[k] = v;
      }
    }
    console.log(JSON.stringify(pop, null, 2));
  }

  // 2. Check purchase.order.line for PO 1569
  console.log("\n=== PURCHASE.ORDER.LINE for PO 1569 ===");
  const poLines = await axios.post(url + '/web/dataset/call_kw', {
    jsonrpc: '2.0', method: 'call', id: 3,
    params: {
      model: 'purchase.order.line', method: 'search_read',
      args: [[['order_id', '=', 1569]]],
      kwargs: { fields: ['product_id', 'product_qty', 'qty_received', 'price_unit', 'price_subtotal', 'currency_id', 'product_uom'], limit: 5, context: ctx }
    }
  }, { headers: { Cookie: cookie } });
  console.log(JSON.stringify(poLines.data.result, null, 2));

  // 3. Check purchase.order 1569 for more details
  console.log("\n=== PURCHASE.ORDER 1569 ===");
  const po = await axios.post(url + '/web/dataset/call_kw', {
    jsonrpc: '2.0', method: 'call', id: 4,
    params: {
      model: 'purchase.order', method: 'search_read',
      args: [[['id', '=', 1569]]],
      kwargs: { fields: ['name', 'partner_id', 'currency_id', 'amount_total', 'user_id', 'date_planned', 'x_studio_procurement_officer'], limit: 1, context: ctx }
    }
  }, { headers: { Cookie: cookie } });
  console.log(JSON.stringify(po.data.result, null, 2));

  // 4. Check a WELL-POPULATED supplier (National Company = partner 1002 approx)
  console.log("\n=== NATIONAL COMPANY picking (well-populated) ===");
  const natPick = await axios.post(url + '/web/dataset/call_kw', {
    jsonrpc: '2.0', method: 'call', id: 5,
    params: {
      model: 'stock.picking', method: 'search_read',
      args: [[['partner_id.name', 'ilike', 'National Company'], ['picking_type_code', '=', 'incoming']]],
      kwargs: {
        fields: [
          'name', 'origin', 'partner_id', 'scheduled_date', 'product_id', 'product_type',
          'x_studio_net_weight_in_tons', 'x_studio_loading_datetime',
          'x_studio_purchase_currency', 'x_studio_currency_id',
          'x_studio_loadcontainer_number_1', 'truck_load_serial_tl',
          'grade', 'user_id', 'agreed_product_price_per_unit',
          'picking_type_id', 'location_dest_id', 'move_ids', 'purchase_id',
          'company_id'
        ],
        limit: 2,
        context: ctx
      }
    }
  }, { headers: { Cookie: cookie } });
  console.log(JSON.stringify(natPick.data.result, null, 2));
}
run().catch(e => console.error(e.response?.data || e.message));
