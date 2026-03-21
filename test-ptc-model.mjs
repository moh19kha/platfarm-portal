import axios from 'axios';
const ODOO_URL = 'https://odoo.platfarm.io';
const ODOO_DB = 'odoo';
const ODOO_USER = 'aiagent';
const ODOO_PASS = 'Platfarm@2025';

async function jsonRpc(url, method, params) {
  const { data } = await axios.post(url, { jsonrpc: '2.0', id: 1, method, params });
  if (data.error) throw new Error(JSON.stringify(data.error.data || data.error));
  return data.result;
}

async function main() {
  const uid = await jsonRpc(ODOO_URL + '/jsonrpc', 'call', {
    service: 'common', method: 'authenticate',
    args: [ODOO_DB, ODOO_USER, ODOO_PASS, {}]
  });
  console.log('UID:', uid);

  const ek = (model, method, args, kwargs = {}) =>
    jsonRpc(ODOO_URL + '/jsonrpc', 'call', {
      service: 'object', method: 'execute_kw',
      args: [ODOO_DB, uid, ODOO_PASS, model, method, args, kwargs]
    });

  // 1. Get ALL fields on pf.petty.cash
  console.log('\n=== pf.petty.cash FIELDS ===');
  const ptcFields = await ek('pf.petty.cash', 'fields_get', [], { attributes: ['string', 'type', 'selection', 'required', 'relation'] });
  for (const [name, info] of Object.entries(ptcFields).sort((a, b) => a[0].localeCompare(b[0]))) {
    let desc = `${name}: ${info.type} - "${info.string}"`;
    if (info.selection) desc += ` [${info.selection.map(s => s[0]).join(', ')}]`;
    if (info.relation) desc += ` → ${info.relation}`;
    if (info.required) desc += ' (REQUIRED)';
    console.log(desc);
  }

  // 2. Get ALL fields on pf.petty.cash.request
  console.log('\n=== pf.petty.cash.request FIELDS ===');
  const reqFields = await ek('pf.petty.cash.request', 'fields_get', [], { attributes: ['string', 'type', 'selection', 'required', 'relation'] });
  for (const [name, info] of Object.entries(reqFields).sort((a, b) => a[0].localeCompare(b[0]))) {
    let desc = `${name}: ${info.type} - "${info.string}"`;
    if (info.selection) desc += ` [${info.selection.map(s => s[0]).join(', ')}]`;
    if (info.relation) desc += ` → ${info.relation}`;
    if (info.required) desc += ' (REQUIRED)';
    console.log(desc);
  }

  // 3. Get existing pf.petty.cash records to see transaction_type values in use
  console.log('\n=== EXISTING pf.petty.cash RECORDS ===');
  const ptcRecords = await ek('pf.petty.cash', 'search_read', [[]], {
    fields: ['name', 'employee_id', 'transaction_type', 'amount', 'state', 'date', 'balance_after', 'notes', 'petty_cash_request_id', 'company_id'],
    limit: 20
  });
  for (const r of ptcRecords) {
    console.log(`${r.name}: type=${r.transaction_type} amount=${r.amount} state=${r.state} balance=${r.balance_after} emp=${r.employee_id?.[1]} company=${r.company_id?.[1]} notes="${r.notes}" req_id=${r.petty_cash_request_id}`);
  }

  // 4. Check if there are any expense-related transaction types
  console.log('\n=== transaction_type SELECTION VALUES ===');
  const ttField = ptcFields['transaction_type'];
  if (ttField?.selection) {
    for (const [val, label] of ttField.selection) {
      console.log(`  ${val}: ${label}`);
    }
  }

  // 5. Check state selection values
  console.log('\n=== state SELECTION VALUES ===');
  const stField = ptcFields['state'];
  if (stField?.selection) {
    for (const [val, label] of stField.selection) {
      console.log(`  ${val}: ${label}`);
    }
  }

  // 6. Check available methods on pf.petty.cash
  console.log('\n=== TESTING pf.petty.cash METHODS ===');
  for (const m of ['action_confirm', 'action_draft', 'action_cancel', 'action_approve', 'action_refuse']) {
    try {
      await ek('pf.petty.cash', m, [[999999]]);
      console.log(`  ${m}: EXISTS (success)`);
    } catch (e) {
      const msg = e.message;
      if (msg.includes('does not exist') || msg.includes('has no method')) {
        console.log(`  ${m}: NOT FOUND`);
      } else {
        console.log(`  ${m}: EXISTS (error: ${msg.slice(-150)})`);
      }
    }
  }

  // 7. Check pf.petty.cash.request existing records
  console.log('\n=== EXISTING pf.petty.cash.request RECORDS ===');
  const reqRecords = await ek('pf.petty.cash.request', 'search_read', [[]], {
    fields: ['name', 'employee_id', 'requested_amount', 'approved_amount', 'state', 'reason', 'create_date', 'petty_cash_id', 'company_id'],
    limit: 20
  });
  for (const r of reqRecords) {
    console.log(`${r.name}: state=${r.state} req_amt=${r.requested_amount} appr_amt=${r.approved_amount} emp=${r.employee_id?.[1]} ptc_id=${r.petty_cash_id} reason="${r.reason}"`);
  }
}

main().catch(e => console.error('FATAL:', e.message));
