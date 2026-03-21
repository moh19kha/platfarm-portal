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
  
  // Get all fields on stock.picking
  const fields = await call(object, 'execute_kw', [
    db, uid, password,
    'stock.picking', 'fields_get',
    [],
    { attributes: ['string', 'type', 'relation'] }
  ]);

  // Filter for x_studio fields related to quality, receiver, offload, driver, officer
  const keywords = ['quality', 'receiv', 'offload', 'driver', 'officer', 'supervisor', 'team', 'inspector', 'checker', 'personnel', 'responsible', 'assigned'];
  
  console.log('\n=== ALL x_studio fields on stock.picking ===\n');
  const xStudioFields = Object.entries(fields)
    .filter(([k]) => k.startsWith('x_studio'))
    .sort(([a], [b]) => a.localeCompare(b));
  
  for (const [name, info] of xStudioFields) {
    console.log(`${name} | type: ${info.type} | label: "${info.string}" ${info.relation ? `| relation: ${info.relation}` : ''}`);
  }

  console.log('\n=== Relevant fields (quality/receiver/offload/driver/officer) ===\n');
  for (const [name, info] of xStudioFields) {
    const combined = `${name} ${info.string || ''}`.toLowerCase();
    if (keywords.some(kw => combined.includes(kw))) {
      console.log(`${name} | type: ${info.type} | label: "${info.string}" ${info.relation ? `| relation: ${info.relation}` : ''}`);
    }
  }
}

main().catch(console.error);
