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

  const object = createClient('/xmlrpc/2/object');
  
  const teamFields = [
    'id', 'name',
    'quality_supervisor_ids', 'loading_driver_ids', 'labor_ids',
    'quality_supervisor_for_delivery',
    'x_studio_quality_supervisor_for_delivery'
  ];

  // Find pickings that have quality_supervisor_ids set
  const pickings = await call(object, 'execute_kw', [
    db, uid, password,
    'stock.picking', 'search_read',
    [[["quality_supervisor_ids", "!=", false], ["picking_type_id.code", "=", "incoming"]]],
    { fields: teamFields, limit: 5, order: 'id desc' }
  ]);
  
  console.log('=== Pickings with quality_supervisor_ids ===\n');
  for (const p of pickings) {
    console.log(`Picking ${p.id} (${p.name}):`);
    console.log(`  quality_supervisor_ids: ${JSON.stringify(p.quality_supervisor_ids)}`);
    console.log(`  loading_driver_ids: ${JSON.stringify(p.loading_driver_ids)}`);
    console.log(`  labor_ids: ${JSON.stringify(p.labor_ids)}`);
    console.log(`  quality_supervisor_for_delivery: ${JSON.stringify(p.quality_supervisor_for_delivery)}`);
    console.log(`  x_studio_quality_supervisor_for_delivery: ${JSON.stringify(p.x_studio_quality_supervisor_for_delivery)}`);
  }

  // Resolve employee names for the first picking
  if (pickings.length > 0) {
    const allIds = new Set();
    for (const p of pickings) {
      (p.quality_supervisor_ids || []).forEach(id => allIds.add(id));
      (p.loading_driver_ids || []).forEach(id => allIds.add(id));
      (p.labor_ids || []).forEach(id => allIds.add(id));
    }
    
    if (allIds.size > 0) {
      const employees = await call(object, 'execute_kw', [
        db, uid, password,
        'hr.employee', 'read',
        [[...allIds], ['id', 'name']]
      ]);
      console.log('\n=== Employee names ===');
      for (const emp of employees) {
        console.log(`  ${emp.id}: ${emp.name}`);
      }
    }
  }
}

main().catch(console.error);
