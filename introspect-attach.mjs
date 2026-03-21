/**
 * Introspect pf.attachment, ir.attachment, purchase.order origin/notes,
 * and check if pf.procurement has any PO-linkage field
 */
const ODOO_URL = 'https://odoo.platfarm.io';
const ODOO_DB = 'odoo';
const ODOO_USER = 'aiagent';
const ODOO_PASSWORD = 'Platfarm@2025';

async function jsonRpc(endpoint, params) {
  const res = await fetch(`${ODOO_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params, id: Date.now() }),
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function auth() {
  return jsonRpc('/jsonrpc', { service: 'common', method: 'authenticate', args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}] });
}

async function fieldsGet(uid, model) {
  return jsonRpc('/jsonrpc', { service: 'object', method: 'execute_kw', args: [ODOO_DB, uid, ODOO_PASSWORD, model, 'fields_get', [], { attributes: ['string', 'type', 'relation'] }] });
}

async function searchRead(uid, model, domain, fields, limit) {
  return jsonRpc('/jsonrpc', { service: 'object', method: 'execute_kw', args: [ODOO_DB, uid, ODOO_PASSWORD, model, 'search_read', [domain], { fields, limit: limit || 1 }] });
}

async function main() {
  const uid = await auth();
  console.log('UID:', uid);

  // 1. pf.attachment fields
  console.log('\n=== pf.attachment fields ===');
  try {
    const f = await fieldsGet(uid, 'pf.attachment');
    for (const [k, v] of Object.entries(f).sort(([a],[b]) => a.localeCompare(b))) {
      console.log(`  ${k}: ${v.type}${v.relation ? ' → ' + v.relation : ''} — "${v.string}"`);
    }
    const sample = await searchRead(uid, 'pf.attachment', [], Object.keys(f), 1);
    console.log('SAMPLE:', JSON.stringify(sample[0] || {}, null, 2));
  } catch(e) { console.log('ERROR:', e.message); }

  // 2. purchase.order: origin, notes, source fields
  console.log('\n=== purchase.order: origin/notes/source fields ===');
  const poF = await fieldsGet(uid, 'purchase.order');
  for (const k of ['origin', 'notes', 'source_document', 'x_studio_procurement_ref']) {
    if (poF[k]) console.log(`  ${k}: ${poF[k].type} — "${poF[k].string}"`);
    else console.log(`  ${k}: NOT FOUND`);
  }

  // 3. pf.procurement: any PO-linkage fields?
  console.log('\n=== pf.procurement: purchase/order/po/shipment fields ===');
  const procF = await fieldsGet(uid, 'pf.procurement');
  const poRelated = Object.entries(procF).filter(([k]) =>
    k.includes('purchase') || k.includes('order') || k.includes('po_') || k.includes('_po') || k.includes('shipment') || k.includes('converted')
  );
  if (poRelated.length === 0) {
    console.log('  (none — will use notes/origin on PO side only, or need Odoo Studio field)');
  } else {
    for (const [k, v] of poRelated) console.log(`  ${k}: ${v.type} — "${v.string}"`);
  }

  // 4. ir.attachment key fields (for copying attachments to PO)
  console.log('\n=== ir.attachment key fields ===');
  const irF = await fieldsGet(uid, 'ir.attachment');
  for (const k of ['name', 'datas', 'res_model', 'res_id', 'type', 'url', 'mimetype', 'file_size', 'store_fname']) {
    if (irF[k]) console.log(`  ${k}: ${irF[k].type} — "${irF[k].string}"`);
  }
}

main().catch(console.error);
