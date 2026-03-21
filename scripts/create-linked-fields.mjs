/**
 * Script: create-linked-fields.mjs
 *
 * Creates dedicated fields in Odoo to store linked PO/MO references:
 *   pf.procurement → x_studio_linked_po (Char), x_studio_linked_po_id (Integer)
 *   pf.pressing    → x_studio_linked_mo (Char), x_studio_linked_mo_id (Integer)
 *
 * Run: node scripts/create-linked-fields.mjs
 */

import xmlrpc from "xmlrpc";

const ODOO_URL  = "https://odoo.platfarm.io";
const ODOO_DB   = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASS = "Platfarm@2025";

// ─── XML-RPC helpers ────────────────────────────────────────────────────────

function makeClient(path) {
  return xmlrpc.createSecureClient({ host: "odoo.platfarm.io", port: 443, path });
}

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, val) => {
      if (err) reject(err);
      else resolve(val);
    });
  });
}

async function authenticate() {
  const common = makeClient("/xmlrpc/2/common");
  const uid = await call(common, "authenticate", [ODOO_DB, ODOO_USER, ODOO_PASS, {}]);
  if (!uid) throw new Error("Authentication failed — check credentials");
  console.log(`✓ Authenticated as uid=${uid}`);
  return uid;
}

async function executeKw(uid, model, method, args, kwargs = {}) {
  const obj = makeClient("/xmlrpc/2/object");
  return call(obj, "execute_kw", [ODOO_DB, uid, ODOO_PASS, model, method, args, kwargs]);
}

// ─── Field creation helper ───────────────────────────────────────────────────

async function ensureField(uid, modelName, fieldName, fieldType, fieldString, description) {
  // Check if field already exists
  const existing = await executeKw(uid, "ir.model.fields", "search_read",
    [[["model", "=", modelName], ["name", "=", fieldName]]],
    { fields: ["id", "name", "ttype", "field_description"] }
  );

  if (existing.length > 0) {
    console.log(`  ⚠ '${fieldName}' already exists on '${modelName}' (id=${existing[0].id}, type=${existing[0].ttype}) — skipping`);
    return existing[0].id;
  }

  // Get model ID
  const models = await executeKw(uid, "ir.model", "search_read",
    [[["model", "=", modelName]]],
    { fields: ["id", "name"] }
  );
  if (!models.length) throw new Error(`Model '${modelName}' not found in ir.model`);
  const modelId = models[0].id;

  // Create the field
  const newId = await executeKw(uid, "ir.model.fields", "create", [{
    model_id: modelId,
    name: fieldName,
    ttype: fieldType,
    field_description: fieldString,
    help: description,
    required: false,
    readonly: false,
    store: true,
    ...(fieldType === "char" ? { size: 64 } : {}),
  }]);

  console.log(`  ✓ Created '${fieldName}' (${fieldType}) on '${modelName}' → id=${newId}`);
  return newId;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nConnecting to ${ODOO_URL} (db: ${ODOO_DB})...\n`);
  const uid = await authenticate();

  // ── pf.procurement ─────────────────────────────────────────────────────────
  console.log("\n[pf.procurement] Ensuring linked PO fields...");
  await ensureField(
    uid, "pf.procurement",
    "x_studio_linked_po", "char",
    "Linked Purchase Order",
    "Reference of the Purchase Order created from this procurement record (e.g. PO/00042)"
  );
  await ensureField(
    uid, "pf.procurement",
    "x_studio_linked_po_id", "integer",
    "Linked PO ID",
    "Odoo ID of the Purchase Order created from this procurement record"
  );

  // ── pf.pressing ────────────────────────────────────────────────────────────
  console.log("\n[pf.pressing] Ensuring linked MO fields...");
  await ensureField(
    uid, "pf.pressing",
    "x_studio_linked_mo", "char",
    "Linked Manufacturing Order",
    "Reference of the Manufacturing Order created from this pressing shift (e.g. WH/MO/00018)"
  );
  await ensureField(
    uid, "pf.pressing",
    "x_studio_linked_mo_id", "integer",
    "Linked MO ID",
    "Odoo ID of the Manufacturing Order created from this pressing shift"
  );

  // ── Verify ─────────────────────────────────────────────────────────────────
  console.log("\n[Verification] Reading back fields from Odoo...");

  const procFields = await executeKw(uid, "ir.model.fields", "search_read",
    [[["model", "=", "pf.procurement"], ["name", "in", ["x_studio_linked_po", "x_studio_linked_po_id"]]]],
    { fields: ["id", "name", "ttype", "field_description"] }
  );
  console.log("\n  pf.procurement:");
  procFields.forEach(f => console.log(`    id=${f.id}  name=${f.name}  type=${f.ttype}  label="${f.field_description}"`));

  const pressFields = await executeKw(uid, "ir.model.fields", "search_read",
    [[["model", "=", "pf.pressing"], ["name", "in", ["x_studio_linked_mo", "x_studio_linked_mo_id"]]]],
    { fields: ["id", "name", "ttype", "field_description"] }
  );
  console.log("\n  pf.pressing:");
  pressFields.forEach(f => console.log(`    id=${f.id}  name=${f.name}  type=${f.ttype}  label="${f.field_description}"`));

  if (procFields.length === 2 && pressFields.length === 2) {
    console.log("\n✅ All 4 fields verified in Odoo.\n");
  } else {
    console.warn(`\n⚠ Expected 4 fields total, found ${procFields.length + pressFields.length}. Check above output.\n`);
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
