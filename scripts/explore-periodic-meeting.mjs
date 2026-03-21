import axios from 'axios';

const ODOO_URL = 'https://odoo.platfarm.io';
const ODOO_DB = 'odoo';
const ODOO_USER = 'aiagent';
const ODOO_PASSWORD = 'Platfarm@2025';
const ALLOWED = [1, 2, 3, 4, 5];

const client = axios.create({ baseURL: ODOO_URL, headers: { 'Content-Type': 'application/json' }, timeout: 60000 });

let _uid = null;

async function getUid() {
  if (_uid) return _uid;
  const resp = await client.post('/jsonrpc', {
    jsonrpc: '2.0', method: 'call', id: 1,
    params: { service: 'common', method: 'authenticate', args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}] }
  });
  if (resp.data.error) throw new Error('Auth error: ' + JSON.stringify(resp.data.error));
  _uid = resp.data.result;
  if (!_uid) throw new Error('Auth failed — bad credentials');
  console.log('Authenticated as UID:', _uid);
  return _uid;
}

async function rpc(model, method, args = [], kwargs = {}) {
  const uid = await getUid();
  const resp = await client.post('/jsonrpc', {
    jsonrpc: '2.0', method: 'call', id: Date.now(),
    params: {
      service: 'object', method: 'execute_kw',
      args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args,
        { ...kwargs, context: { allowed_company_ids: ALLOWED } }]
    }
  });
  if (resp.data.error) throw new Error(JSON.stringify(resp.data.error));
  return resp.data.result;
}

async function main() {
  // 1. Get fields
  console.log('\n=== periodic.meeting FIELDS ===');
  const fields = await rpc('periodic.meeting', 'fields_get', [], { attributes: ['string', 'type', 'relation'] });
  Object.entries(fields).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(35)} ${v.type.padEnd(15)} "${v.string}"${v.relation ? ' → ' + v.relation : ''}`);
  });

  // 2. Count records
  const count = await rpc('periodic.meeting', 'search_count', [[]], {});
  console.log(`\n=== TOTAL RECORDS: ${count} ===`);

  // 3. Fetch a sample of records
  const sample = await rpc('periodic.meeting', 'search_read', [[]], {
    fields: Object.keys(fields),
    limit: 3,
    order: 'id desc'
  });
  console.log('\n=== SAMPLE RECORDS (3 most recent) ===');
  sample.forEach((r, i) => {
    console.log(`\n--- Record ${i + 1} ---`);
    Object.entries(r).forEach(([k, v]) => {
      if (v !== false && v !== null && v !== '') {
        console.log(`  ${k}: ${JSON.stringify(v)}`);
      }
    });
  });

  // 4. Check for attendance/line relation models
  const relModels = Object.entries(fields)
    .filter(([, v]) => v.type === 'one2many' || v.type === 'many2many')
    .map(([k, v]) => ({ field: k, model: v.relation }));
  console.log('\n=== ONE2MANY / MANY2MANY RELATIONS ===');
  relModels.forEach(r => console.log(`  ${r.field} → ${r.model}`));

  // 5. If there's an attendance line model, explore it
  for (const rel of relModels) {
    if (rel.model && rel.model !== 'periodic.meeting') {
      try {
        const relFields = await rpc(rel.model, 'fields_get', [], { attributes: ['string', 'type', 'relation'] });
        console.log(`\n=== ${rel.model} FIELDS (via ${rel.field}) ===`);
        Object.entries(relFields).forEach(([k, v]) => {
          console.log(`  ${k.padEnd(35)} ${v.type.padEnd(15)} "${v.string}"${v.relation ? ' → ' + v.relation : ''}`);
        });
        const relCount = await rpc(rel.model, 'search_count', [[]], {});
        console.log(`  TOTAL RECORDS: ${relCount}`);
        const relSample = await rpc(rel.model, 'search_read', [[]], {
          fields: Object.keys(relFields).slice(0, 15),
          limit: 3,
          order: 'id desc'
        });
        console.log(`  SAMPLE:`);
        relSample.forEach((r, i) => {
          console.log(`  --- ${i + 1} ---`);
          Object.entries(r).forEach(([k, v]) => {
            if (v !== false && v !== null && v !== '') console.log(`    ${k}: ${JSON.stringify(v)}`);
          });
        });
      } catch (e) {
        console.log(`  Could not explore ${rel.model}: ${e.message}`);
      }
    }
  }
}

main().catch(e => console.error('FAILED:', e.message));
