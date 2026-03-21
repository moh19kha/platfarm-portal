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
  if (!_uid) throw new Error('Auth failed');
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
  // 1. Get all fields for periodic.meeting
  console.log('\n=== periodic.meeting ALL FIELDS ===');
  const fields = await rpc('periodic.meeting', 'fields_get', [], { attributes: ['string', 'type', 'relation', 'required', 'readonly', 'store'] });
  Object.entries(fields).forEach(([k, v]) => {
    const flags = [v.required && 'REQUIRED', v.readonly && 'READONLY', !v.store && 'COMPUTED'].filter(Boolean).join(',');
    console.log(`  ${k.padEnd(35)} ${v.type.padEnd(15)} "${v.string}"${v.relation ? ' → ' + v.relation : ''}${flags ? ' [' + flags + ']' : ''}`);
  });

  // 2. Get the most recent meeting with ALL fields to understand structure
  console.log('\n=== MOST RECENT MEETING (full detail) ===');
  const recent = await rpc('periodic.meeting', 'search_read', [[]], {
    fields: Object.keys(fields),
    limit: 1,
    order: 'id desc'
  });
  if (recent.length > 0) {
    Object.entries(recent[0]).forEach(([k, v]) => {
      if (v !== false && v !== null && v !== '') {
        console.log(`  ${k}: ${JSON.stringify(v)}`);
      }
    });
  }

  // 3. Explore related action/task models
  const relModels = Object.entries(fields)
    .filter(([, v]) => (v.type === 'one2many' || v.type === 'many2many') && v.relation)
    .map(([k, v]) => ({ field: k, model: v.relation }));

  console.log('\n=== RELATED MODELS ===');
  for (const rel of relModels) {
    console.log(`\n--- ${rel.field} → ${rel.model} ---`);
    try {
      const relFields = await rpc(rel.model, 'fields_get', [], { attributes: ['string', 'type', 'relation', 'required', 'selection'] });
      Object.entries(relFields).forEach(([k, v]) => {
        const sel = v.selection ? ' [' + v.selection.map(s => s[0]).join('|') + ']' : '';
        console.log(`    ${k.padEnd(35)} ${v.type.padEnd(15)} "${v.string}"${v.relation ? ' → ' + v.relation : ''}${sel}`);
      });
      const count = await rpc(rel.model, 'search_count', [[]], {});
      console.log(`    TOTAL RECORDS: ${count}`);
      if (count > 0) {
        const sample = await rpc(rel.model, 'search_read', [[]], {
          fields: Object.keys(relFields),
          limit: 3,
          order: 'id desc'
        });
        console.log(`    SAMPLE (3 most recent):`);
        sample.forEach((r, i) => {
          console.log(`    --- ${i + 1} ---`);
          Object.entries(r).forEach(([k, v]) => {
            if (v !== false && v !== null && v !== '') console.log(`      ${k}: ${JSON.stringify(v)}`);
          });
        });
      }
    } catch (e) {
      console.log(`    ERROR: ${e.message.substring(0, 200)}`);
    }
  }

  // 4. Check what companies exist for the meeting company_id field
  console.log('\n=== AVAILABLE COMPANIES ===');
  const companies = await rpc('res.company', 'search_read', [[]], { fields: ['id', 'name'], limit: 20 });
  companies.forEach(c => console.log(`  ${c.id}: ${c.name}`));

  // 5. Check available employees for attendee_ids
  console.log('\n=== AVAILABLE EMPLOYEES (sample) ===');
  const emps = await rpc('hr.employee', 'search_read', [[['active', '=', true]]], {
    fields: ['id', 'name', 'job_title', 'company_id'],
    limit: 10,
    order: 'name asc'
  });
  emps.forEach(e => console.log(`  ${e.id}: ${e.name} (${e.job_title || 'N/A'}) - ${e.company_id ? e.company_id[1] : 'N/A'}`));
}

main().catch(e => console.error('FAILED:', e.message));
