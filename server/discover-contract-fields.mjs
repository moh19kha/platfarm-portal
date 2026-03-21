import axios from 'axios';
const url = 'https://odoo.platfarm.io';
const db = 'odoo';
const user = 'aiagent';
const pass = 'Platfarm@2025';

async function main() {
  const uidRes = await axios.post(url+'/jsonrpc', {jsonrpc:'2.0',method:'call',params:{service:'common',method:'authenticate',args:[db,user,pass,{}]}});
  const uid = uidRes.data.result;
  console.log('UID:', uid);

  const res = await axios.post(url+'/jsonrpc', {jsonrpc:'2.0',method:'call',params:{service:'object',method:'execute_kw',args:[db,uid,pass,'hr.contract','fields_get',[],{attributes:['string','type']}]}});
  const fields = res.data.result;
  const relevant = Object.entries(fields).filter(([k,v]) => {
    const str = v.string || '';
    return /wage|salary|housing|transport|allow|bonus|other|struct|schedule|calendar/i.test(k) || /wage|salary|housing|transport|allow|bonus|other/i.test(str);
  });
  console.log('\n=== Relevant hr.contract fields ===');
  relevant.forEach(([k,v]) => console.log(`  ${k} - "${v.string}" - ${v.type}`));

  // Also check a sample contract to see actual values
  const contracts = await axios.post(url+'/jsonrpc', {jsonrpc:'2.0',method:'call',params:{service:'object',method:'execute_kw',args:[db,uid,pass,'hr.contract','search_read',[[['state','=','open']]],{fields:relevant.map(([k])=>k).concat(['name','employee_id','state','date_start','date_end','wage']),limit:2,context:{'allowed_company_ids':[1,3]}}]}});
  console.log('\n=== Sample contracts ===');
  contracts.data.result.forEach(c => console.log(JSON.stringify(c, null, 2)));
}
main().catch(e => console.error(e.message));
