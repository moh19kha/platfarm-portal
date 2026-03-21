import axios from 'axios';

const url = 'https://odoo.platfarm.io';
const db = 'odoo';

async function run() {
  const auth = await axios.post(url + '/web/session/authenticate', {
    jsonrpc: '2.0', method: 'call', id: 1,
    params: { db, login: 'aiagent', password: 'Platfarm@2025' }
  });
  const cookie = auth.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // Find Ali Gomaa partner
  const partners = await axios.post(url + '/web/dataset/call_kw', {
    jsonrpc: '2.0', method: 'call', id: 2,
    params: {
      model: 'res.partner', method: 'search_read',
      args: [[['name', 'ilike', 'Ali Gomaa']]],
      kwargs: { fields: ['id', 'name'], limit: 5, context: { allowed_company_ids: [1,2,3,5] } }
    }
  }, { headers: { Cookie: cookie } });
  console.log('Partners:', JSON.stringify(partners.data.result));

  const partnerIds = partners.data.result.map(p => p.id);
  if (partnerIds.length === 0) { console.log('No partner'); return; }

  // Fetch ONE picking with ALL fields
  const pickings = await axios.post(url + '/web/dataset/call_kw', {
    jsonrpc: '2.0', method: 'call', id: 3,
    params: {
      model: 'stock.picking', method: 'search_read',
      args: [[['partner_id', 'in', partnerIds], ['picking_type_code', '=', 'incoming']]],
      kwargs: {
        fields: [],
        limit: 1,
        context: { allowed_company_ids: [1,2,3,5] }
      }
    }
  }, { headers: { Cookie: cookie } });

  const rec = pickings.data.result[0];
  if (rec === undefined) { console.log('No pickings found'); return; }

  // Print only non-false, non-empty fields
  const populated = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v !== false && v !== '' && v !== null && v !== 0 && JSON.stringify(v) !== '[]') {
      populated[k] = v;
    }
  }
  console.log(JSON.stringify(populated, null, 2));
}
run().catch(e => console.error(e.response?.data || e.message));
