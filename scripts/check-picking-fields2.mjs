import xmlrpc from 'xmlrpc';

const url = 'http://157.175.170.246:8069';
const db = 'odoo';
const username = 'aiagent@gmail.com';
const password = 'Platfarm@2025';

function createClient(path) {
  const u = new URL(path, url);
  const opts = { host: u.hostname, port: u.port || 80, path: u.pathname };
  return xmlrpc.createClient(opts);
}

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, val) => err ? reject(err) : resolve(val));
  });
}

async function main() {
  const common = createClient('/xmlrpc/2/common');
  const uid = await call(common, 'authenticate', [db, username, password, {}]);
  console.log('Authenticated, uid:', uid);

  const object = createClient('/xmlrpc/2/object');
  
  const fields = await call(object, 'execute_kw', [
    db, uid, password,
    'stock.picking', 'fields_get',
    [],
    { attributes: ['string', 'type', 'relation'] }
  ]);

  // Show all many2one and many2many x_studio fields (these are person/team fields)
  console.log('\n=== Many2one/Many2many x_studio fields (person/team fields) ===\n');
  const relFields = Object.entries(fields)
    .filter(([k, v]) => k.startsWith('x_studio') && (v.type === 'many2one' || v.type === 'many2many'))
    .sort(([a], [b]) => a.localeCompare(b));
  
  for (const [name, info] of relFields) {
    console.log(`${name} | type: ${info.type} | label: "${info.string}" | relation: ${info.relation}`);
  }

  // Also search for loading, labor, supervisor, team keywords in ALL fields
  console.log('\n=== Fields matching loading/labor/supervisor/team/offload ===\n');
  const keywords = ['loading', 'labor', 'labour', 'supervisor', 'team', 'offload', 'unload', 'receive', 'forklift'];
  const allFields = Object.entries(fields)
    .filter(([k, v]) => {
      const combined = `${k} ${v.string || ''}`.toLowerCase();
      return keywords.some(kw => combined.includes(kw));
    })
    .sort(([a], [b]) => a.localeCompare(b));
  
  for (const [name, info] of allFields) {
    console.log(`${name} | type: ${info.type} | label: "${info.string}" ${info.relation ? `| relation: ${info.relation}` : ''}`);
  }

  // Also read a sample picking to see what values these fields have
  console.log('\n=== Sample picking data for relational fields ===\n');
  const fieldNames = relFields.map(([k]) => k);
  const sample = await call(object, 'execute_kw', [
    db, uid, password,
    'stock.picking', 'search_read',
    [[["picking_type_id.code", "=", "incoming"]]],
    { fields: fieldNames, limit: 3, order: 'id desc' }
  ]);
  
  for (const rec of sample) {
    console.log(`\nPicking ID: ${rec.id}`);
    for (const [name] of relFields) {
      if (rec[name] && rec[name] !== false) {
        console.log(`  ${name}: ${JSON.stringify(rec[name])}`);
      }
    }
  }
}

main().catch(console.error);
