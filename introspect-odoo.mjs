/**
 * Introspect Odoo pf.* models using XML-RPC style JSON-RPC calls
 * (same pattern as executeKw in odoo.ts)
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

async function authenticate() {
  return jsonRpc('/jsonrpc', {
    service: 'common',
    method: 'authenticate',
    args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}],
  });
}

async function fieldsGet(uid, model) {
  return jsonRpc('/jsonrpc', {
    service: 'object',
    method: 'execute_kw',
    args: [ODOO_DB, uid, ODOO_PASSWORD, model, 'fields_get', [], { attributes: ['string', 'type', 'relation'] }],
  });
}

async function searchRead(uid, model, domain, fields, limit) {
  return jsonRpc('/jsonrpc', {
    service: 'object',
    method: 'execute_kw',
    args: [ODOO_DB, uid, ODOO_PASSWORD, model, 'search_read', [domain], { fields, limit: limit || 1 }],
  });
}

async function main() {
  console.log('Authenticating...');
  const uid = await authenticate();
  console.log('UID:', uid);

  const models = ['pf.procurement', 'pf.quality', 'pf.pressing', 'pf.shipping', 'pf.site', 'pf.attachment', 'pf.pressing.staff', 'pf.shipping.staff'];

  for (const model of models) {
    try {
      const fields = await fieldsGet(uid, model);
      const fieldNames = Object.keys(fields).sort();
      console.log(`\n=== ${model} (${fieldNames.length} fields) ===`);
      for (const name of fieldNames) {
        const f = fields[name];
        const rel = f.relation ? ` → ${f.relation}` : '';
        console.log(`  ${name}: ${f.type}${rel} — "${f.string}"`);
      }
      // Also fetch 1 sample record
      try {
        const sample = await searchRead(uid, model, [], fieldNames.filter(n => !['__last_update'].includes(n)), 1);
        if (sample.length > 0) {
          console.log(`  --- SAMPLE RECORD ---`);
          for (const [k, v] of Object.entries(sample[0])) {
            if (v !== false && v !== null && v !== '' && v !== 0) {
              console.log(`    ${k} = ${JSON.stringify(v).substring(0, 120)}`);
            }
          }
        } else {
          console.log(`  --- NO RECORDS ---`);
        }
      } catch (e2) {
        console.log(`  --- SAMPLE ERROR: ${e2.message.substring(0, 100)} ---`);
      }
    } catch (e) {
      console.log(`\n=== ${model} — ERROR: ${e.message.substring(0, 200)} ===`);
    }
  }
}

main().catch(console.error);
