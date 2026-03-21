import axios from "axios";

const ODOO_URL = "http://157.175.170.246:8069";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent@gmail.com";
const ODOO_PASSWORD = "Platfarm@2025";

const client = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

async function authenticate() {
  const res = await client.post("/jsonrpc", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}],
    },
  });
  return res.data.result;
}

async function executeKw(uid, model, method, args, kwargs = {}) {
  const res = await client.post("/jsonrpc", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args],
      kwargs: { ...kwargs, context: { allowed_company_ids: [1, 2, 3, 5] } },
    },
  });
  if (res.data.error) throw new Error(JSON.stringify(res.data.error));
  return res.data.result;
}

async function main() {
  const uid = await authenticate();
  console.log("Authenticated, uid:", uid);

  // Get all fields on mrp.production
  const fields = await executeKw(uid, "mrp.production", "fields_get", [], {
    attributes: ["string", "type", "help"],
  });

  // Filter for binary fields
  const binaryFields = Object.entries(fields)
    .filter(([_, info]) => info.type === "binary")
    .map(([name, info]) => ({
      name,
      label: info.string,
      help: info.help || "",
    }));

  console.log("\n=== Binary Fields on mrp.production ===");
  console.log(`Found ${binaryFields.length} binary fields:\n`);
  binaryFields.forEach(f => {
    console.log(`  ${f.name}: "${f.label}"${f.help ? ` — ${f.help}` : ""}`);
  });

  // Also check for x_studio_ fields (custom fields)
  const studioFields = Object.entries(fields)
    .filter(([name, _]) => name.startsWith("x_studio_"))
    .map(([name, info]) => ({
      name,
      label: info.string,
      type: info.type,
      help: info.help || "",
    }));

  console.log("\n=== All x_studio_ Custom Fields on mrp.production ===");
  console.log(`Found ${studioFields.length} custom fields:\n`);
  studioFields.forEach(f => {
    console.log(`  ${f.name} (${f.type}): "${f.label}"${f.help ? ` — ${f.help}` : ""}`);
  });

  // Check for attachment-related fields (Many2many to ir.attachment)
  const attachmentFields = Object.entries(fields)
    .filter(([_, info]) => info.type === "many2many" && (info.string?.toLowerCase().includes("attach") || info.string?.toLowerCase().includes("document")))
    .map(([name, info]) => ({
      name,
      label: info.string,
      type: info.type,
    }));

  console.log("\n=== Attachment-related Many2many Fields ===");
  console.log(`Found ${attachmentFields.length} fields:\n`);
  attachmentFields.forEach(f => {
    console.log(`  ${f.name} (${f.type}): "${f.label}"`);
  });
}

main().catch(console.error);
