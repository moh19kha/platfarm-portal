import axios from 'axios';

const ODOO_URL = 'https://odoo.platfarm.io';
const ODOO_DB = 'odoo';
const ODOO_USER = 'aiagent';
const ODOO_PASSWORD = 'Platfarm@2025';

const client = axios.create({
  baseURL: ODOO_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

async function getUid() {
  const res = await client.post('/jsonrpc', {
    jsonrpc: '2.0', method: 'call', id: 1,
    params: { service: 'common', method: 'authenticate', args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}] },
  });
  return res.data.result;
}

async function call(uid, model, method, args, kwargs = {}, companyIds = [1,2,3,4,5]) {
  const res = await client.post('/jsonrpc', {
    jsonrpc: '2.0', method: 'call', id: 2,
    params: {
      service: 'object', method: 'execute_kw',
      args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, {
        ...kwargs,
        context: { allowed_company_ids: companyIds },
      }],
    },
  });
  if (res.data.error) throw new Error(JSON.stringify(res.data.error.data?.message || res.data.error));
  return res.data.result;
}

async function main() {
  const uid = await getUid();
  console.log('UID:', uid);

  // 1. All CWDAK pickings (all types, all states)
  console.log('\n=== ALL CWDAK pickings (all types) ===');
  // CWDAK picking type IDs: 125 (internal), 126-142 (incoming/outgoing)
  const cwdakTypeIds = [125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142];
  const allCwdakPickings = await call(uid, 'stock.picking', 'search_read',
    [[['picking_type_id', 'in', cwdakTypeIds]]],
    { fields: ['id', 'name', 'state', 'picking_type_id', 'picking_type_code', 'location_id', 'location_dest_id', 'scheduled_date', 'date_done', 'origin', 'move_ids'], limit: 100, order: 'id desc' }
  );
  console.log('Total CWDAK pickings:', allCwdakPickings.length);
  // Group by type
  const byType = {};
  for (const p of allCwdakPickings) {
    const t = p.picking_type_id[1];
    if (!byType[t]) byType[t] = [];
    byType[t].push(p.name);
  }
  console.log('By type:', JSON.stringify(byType, null, 2));

  // 2. Check MWCP receipts that might reference CWDAK pickings
  console.log('\n=== MWCP receipts with CWDAK in origin ===');
  const mwcpFromCwdak = await call(uid, 'stock.picking', 'search_read',
    [[['location_dest_id.complete_name', 'ilike', 'MWCP'], ['origin', 'ilike', 'CWDAK']]],
    { fields: ['id', 'name', 'state', 'location_id', 'location_dest_id', 'scheduled_date', 'date_done', 'origin'], limit: 20, order: 'id desc' }
  );
  console.log('Count:', mwcpFromCwdak.length);
  console.log(JSON.stringify(mwcpFromCwdak.slice(0, 5), null, 2));

  // 3. Check stock moves with MWCP dest and CWDAK src
  console.log('\n=== Stock moves: CWDAK src -> MWCP dest ===');
  const cwdakLocIds = [122, 123, 130, 131, 132, 133, 134, 135];
  const mwcpLocIds = [67, 68, 112, 113, 114, 115, 117];
  const interMoves = await call(uid, 'stock.move', 'search_read',
    [[['location_id', 'in', cwdakLocIds], ['location_dest_id', 'in', mwcpLocIds]]],
    { fields: ['id', 'name', 'product_id', 'product_uom_qty', 'quantity', 'product_uom', 'location_id', 'location_dest_id', 'state', 'picking_id', 'date'], limit: 20, order: 'id desc' }
  );
  console.log('Count:', interMoves.length);
  console.log(JSON.stringify(interMoves.slice(0, 5), null, 2));

  // 4. Get sample stock moves for CWDAK incoming pickings to see the data structure
  console.log('\n=== Sample stock moves for CWDAK/RM/IN/00027 (id=15042) ===');
  const sampleMoves = await call(uid, 'stock.move', 'search_read',
    [[['picking_id', '=', 15042]]],
    { fields: ['id', 'name', 'product_id', 'product_uom_qty', 'quantity', 'product_uom', 'location_id', 'location_dest_id', 'state', 'date'] }
  );
  console.log(JSON.stringify(sampleMoves, null, 2));

  // 5. Check x_studio fields on stock.picking for CWDAK
  console.log('\n=== x_studio fields on stock.picking ===');
  const pickingFields = await call(uid, 'stock.picking', 'fields_get',
    [],
    { attributes: ['string', 'type'] }
  );
  const xFields = Object.entries(pickingFields)
    .filter(([k]) => k.startsWith('x_studio'))
    .map(([k, v]) => `${k}: ${v.type} (${v.string})`);
  console.log(xFields.join('\n'));
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
