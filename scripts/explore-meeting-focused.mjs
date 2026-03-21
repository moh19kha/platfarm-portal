import axios from 'axios';

const ODOO_URL = 'https://odoo.platfarm.io';
const ODOO_DB = 'odoo';
const ODOO_USER = 'aiagent';
const ODOO_PASSWORD = 'Platfarm@2025';
const ALLOWED = [1, 2, 3, 4, 5];

const client = axios.create({ baseURL: ODOO_URL, headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
let _uid = null;

async function getUid() {
  if (_uid) return _uid;
  const resp = await client.post('/jsonrpc', {
    jsonrpc: '2.0', method: 'call', id: 1,
    params: { service: 'common', method: 'authenticate', args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}] }
  });
  _uid = resp.data.result;
  console.log('UID:', _uid);
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
  if (resp.data.error) throw new Error(JSON.stringify(resp.data.error).substring(0, 300));
  return resp.data.result;
}

async function main() {
  // 1. Get ONLY the stored fields of periodic.meeting (skip computed/relational)
  console.log('\n=== periodic.meeting STORED FIELDS ===');
  const fields = await rpc('periodic.meeting', 'fields_get', [], {
    attributes: ['string', 'type', 'relation', 'required', 'selection', 'store']
  });
  const storedFields = Object.entries(fields).filter(([, v]) => v.store !== false);
  storedFields.forEach(([k, v]) => {
    const sel = v.selection ? ' [' + v.selection.map(s => s[0]).join('|') + ']' : '';
    const req = v.required ? ' REQUIRED' : '';
    console.log(`  ${k.padEnd(30)} ${v.type.padEnd(12)} "${v.string}"${v.relation ? ' → ' + v.relation : ''}${sel}${req}`);
  });

  // 2. Get the most recent meeting with only stored fields
  const storedKeys = storedFields.map(([k]) => k);
  console.log('\n=== MOST RECENT MEETING ===');
  const recent = await rpc('periodic.meeting', 'search_read', [[]], {
    fields: storedKeys, limit: 1, order: 'id desc'
  });
  if (recent[0]) {
    Object.entries(recent[0]).forEach(([k, v]) => {
      if (v !== false && v !== null && v !== '') console.log(`  ${k}: ${JSON.stringify(v)}`);
    });
  }

  // 3. Find one2many/many2many relations (skip mail/website/rating)
  const skipModels = ['mail.', 'website.', 'rating.', 'snailmail.'];
  const relFields = storedFields.filter(([, v]) =>
    (v.type === 'one2many' || v.type === 'many2many') &&
    v.relation &&
    !skipModels.some(s => v.relation.startsWith(s))
  );
  console.log('\n=== KEY RELATIONS ===');
  relFields.forEach(([k, v]) => console.log(`  ${k} → ${v.model || v.relation}`));

  // 4. Explore each key relation
  for (const [fieldName, fieldDef] of relFields) {
    const relModel = fieldDef.relation;
    console.log(`\n--- ${fieldName} → ${relModel} ---`);
    try {
      const relFields2 = await rpc(relModel, 'fields_get', [], {
        attributes: ['string', 'type', 'relation', 'required', 'selection', 'store']
      });
      const stored2 = Object.entries(relFields2).filter(([, v]) => v.store !== false);
      stored2.forEach(([k, v]) => {
        const sel = v.selection ? ' [' + v.selection.map(s => s[0]).join('|') + ']' : '';
        console.log(`    ${k.padEnd(30)} ${v.type.padEnd(12)} "${v.string}"${sel}`);
      });
      const cnt = await rpc(relModel, 'search_count', [[]], {});
      console.log(`    COUNT: ${cnt}`);
      if (cnt > 0) {
        const sample = await rpc(relModel, 'search_read', [[]], {
          fields: stored2.map(([k]) => k), limit: 2, order: 'id desc'
        });
        sample.forEach((r, i) => {
          console.log(`    RECORD ${i+1}:`);
          Object.entries(r).forEach(([k, v]) => {
            if (v !== false && v !== null && v !== '') console.log(`      ${k}: ${JSON.stringify(v)}`);
          });
        });
      }
    } catch (e) {
      console.log(`    ERROR: ${e.message.substring(0, 150)}`);
    }
  }

  // 5. Check available employees (for attendee_ids)
  console.log('\n=== EMPLOYEES (sample 8) ===');
  const emps = await rpc('hr.employee', 'search_read', [[['active', '=', true]]], {
    fields: ['id', 'name', 'job_title', 'company_id'], limit: 8, order: 'name asc'
  });
  emps.forEach(e => console.log(`  ${e.id}: ${e.name} (${e.job_title||'N/A'}) [${e.company_id?e.company_id[1]:'N/A'}]`));
}

main().catch(e => console.error('FAILED:', e.message));
