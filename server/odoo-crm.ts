/**
 * Odoo CRM API Helper — Investment Cycles Management
 * 
 * Uses the Abu Dhabi company's CRM module (crm.lead + crm.stage)
 * to manage investment deal pipelines. Each CRM lead represents
 * an investment deal/cycle that moves through stages.
 */

import axios from "axios";

// ─── Odoo Connection Config ────────────────────────────────────────────────
const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD ?? "Platfarm@2025";

const odooClient = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 120000,
});

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CrmStage {
  id: number;
  name: string;
  sequence: number;
  fold: boolean;
  is_won: boolean;
}

export interface CrmLead {
  id: number;
  name: string;
  partner_id: [number, string] | false;
  stage_id: [number, string] | false;
  user_id: [number, string] | false;
  company_id: [number, string] | false;
  expected_revenue: number;
  probability: number;
  date_deadline: string | false;
  create_date: string;
  write_date: string;
  date_closed: string | false;
  description: string | false;
  contact_name: string | false;
  email_from: string | false;
  phone: string | false;
  city: string | false;
  country_id: [number, string] | false;
  tag_ids: number[];
  activity_ids: number[];
  message_ids: number[];
  priority: string;
  color: number;
  active: boolean;
  type: string; // "lead" or "opportunity"
  team_id: [number, string] | false;
  // Custom fields for investment tracking
  x_studio_investor_type: string | false;
  x_studio_investment_type: string | false;
  x_studio_contract_reference: string | false;
  x_studio_contract_date: string | false;
  x_studio_maturity_date: string | false;
  x_studio_profit_rate: number;
  x_studio_currency: string | false;
  x_studio_bank_name: string | false;
  x_studio_bank_account: string | false;
  x_studio_paid_amount: number;
  x_studio_remaining_amount: number;
  x_studio_national_id: string | false;
  x_studio_address: string | false;
  x_studio_notes: string | false;
}

export interface CrmTag {
  id: number;
  name: string;
  color: number;
}

export interface CrmActivity {
  id: number;
  activity_type_id: [number, string] | false;
  summary: string | false;
  note: string | false;
  date_deadline: string;
  user_id: [number, string] | false;
  res_id: number;
  res_model: string;
  state: string;
  create_date: string;
}

export interface CrmMessage {
  id: number;
  body: string;
  author_id: [number, string] | false;
  date: string;
  message_type: string;
  subtype_id: [number, string] | false;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: string;
  id: number | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: { message: string; debug: string };
  };
}

// ─── UID Cache ─────────────────────────────────────────────────────────────
let _uidPromise: Promise<number> | null = null;

function getUid(): Promise<number> {
  if (_uidPromise) return _uidPromise;
  _uidPromise = (async () => {
    try {
      const res = await odooClient.post<JsonRpcResponse<number | false>>("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "authenticate",
          args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}],
        },
      });
      if (res.data.error) throw new Error(`Odoo auth error: ${res.data.error.data.message}`);
      const uid = res.data.result;
      if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
      return uid;
    } catch (err) {
      _uidPromise = null;
      throw err;
    }
  })();
  return _uidPromise;
}

// ─── Core RPC Helper ───────────────────────────────────────────────────────
const ALLOWED_COMPANY_IDS = [1, 2, 3, 4, 5];

async function executeKw<T = unknown>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {},
  retries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const uid = await getUid();
      const kwargsWithContext = {
        ...kwargs,
        context: {
          ...(kwargs.context as Record<string, unknown> || {}),
          allowed_company_ids: ALLOWED_COMPANY_IDS,
        },
      };
      const res = await odooClient.post<JsonRpcResponse<T>>("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargsWithContext],
        },
      });
      if (res.data.error) {
        if (res.data.error.code === 100 || res.data.error.code === 2) _uidPromise = null;
        throw new Error(`Odoo RPC error (${model}.${method}): ${res.data.error.data.message}`);
      }
      return res.data.result as T;
    } catch (err: any) {
      const isTransient = err.message?.includes('socket hang up') ||
        err.message?.includes('ECONNRESET') ||
        err.code === 'ECONNRESET' ||
        err.code === 'ECONNREFUSED';
      if (isTransient && attempt < retries) {
        _uidPromise = null;
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('executeKw: exhausted retries');
}

// ─── Abu Dhabi Company ID ──────────────────────────────────────────────────
// The user uses the Abu Dhabi company's CRM for investment management
const ABU_DHABI_COMPANY_ID = 1;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Fetch CRM stages (pipeline stages)
 */
export async function fetchCrmStages(): Promise<CrmStage[]> {
  return executeKw<CrmStage[]>(
    "crm.stage",
    "search_read",
    [[]],
    {
      fields: ["id", "name", "sequence", "fold", "is_won"],
      order: "sequence asc",
    }
  );
}

/**
 * Fetch CRM leads/opportunities (investment deals)
 * Filtered to Abu Dhabi company
 */
export async function fetchCrmLeads(
  companyId?: number,
  stageId?: number,
  limit?: number
): Promise<CrmLead[]> {
  const domain: any[] = [];
  if (companyId) {
    domain.push(["company_id", "=", companyId]);
  }
  if (stageId) {
    domain.push(["stage_id", "=", stageId]);
  }

  const fields = [
    "id", "name", "partner_id", "stage_id", "user_id", "company_id",
    "expected_revenue", "probability", "date_deadline", "create_date",
    "write_date", "date_closed", "description", "contact_name",
    "email_from", "phone", "city", "country_id", "tag_ids",
    "activity_ids", "message_ids", "priority", "color", "active", "type",
    "team_id",
  ];

  // Try to include custom fields, but don't fail if they don't exist
  const customFields = [
    "x_studio_investor_type", "x_studio_investment_type",
    "x_studio_contract_reference", "x_studio_contract_date",
    "x_studio_maturity_date", "x_studio_profit_rate", "x_studio_currency",
    "x_studio_bank_name", "x_studio_bank_account",
    "x_studio_paid_amount", "x_studio_remaining_amount",
    "x_studio_national_id", "x_studio_address", "x_studio_notes",
  ];

  const kwargs: Record<string, unknown> = {
    fields: [...fields, ...customFields],
    order: "create_date desc",
  };
  if (limit) kwargs.limit = limit;

  try {
    return await executeKw<CrmLead[]>("crm.lead", "search_read", [domain], kwargs);
  } catch (err: any) {
    // If custom fields don't exist, retry without them
    if (err.message?.includes("x_studio_")) {
      kwargs.fields = fields;
      return executeKw<CrmLead[]>("crm.lead", "search_read", [domain], kwargs);
    }
    throw err;
  }
}

/**
 * Fetch a single CRM lead by ID
 */
export async function fetchCrmLeadById(leadId: number): Promise<CrmLead | null> {
  const standardFields = [
    "id", "name", "partner_id", "stage_id", "user_id", "company_id",
    "expected_revenue", "probability", "date_deadline", "create_date",
    "write_date", "date_closed", "description", "contact_name",
    "email_from", "phone", "city", "country_id", "tag_ids",
    "activity_ids", "message_ids", "priority", "color", "active", "type",
    "team_id",
  ];
  const customFields = [
    "x_studio_investor_type", "x_studio_investment_type",
    "x_studio_contract_reference", "x_studio_contract_date",
    "x_studio_maturity_date", "x_studio_profit_rate", "x_studio_currency",
    "x_studio_bank_name", "x_studio_bank_account",
    "x_studio_paid_amount", "x_studio_remaining_amount",
    "x_studio_national_id", "x_studio_address", "x_studio_notes",
  ];
  try {
    const results = await executeKw<CrmLead[]>(
      "crm.lead",
      "search_read",
      [[["id", "=", leadId]]],
      { fields: [...standardFields, ...customFields] }
    );
    return results.length > 0 ? results[0] : null;
  } catch (err: any) {
    if (err.message?.includes("x_studio_")) {
      const results = await executeKw<CrmLead[]>(
        "crm.lead",
        "search_read",
        [[["id", "=", leadId]]],
        { fields: standardFields }
      );
      return results.length > 0 ? results[0] : null;
    }
    throw err;
  }
}

/**
 * Fetch CRM tags
 */
export async function fetchCrmTags(): Promise<CrmTag[]> {
  return executeKw<CrmTag[]>(
    "crm.tag",
    "search_read",
    [[]],
    { fields: ["id", "name", "color"] }
  );
}

/**
 * Fetch activities for a CRM lead
 */
export async function fetchCrmActivities(leadId: number): Promise<CrmActivity[]> {
  return executeKw<CrmActivity[]>(
    "mail.activity",
    "search_read",
    [[["res_model", "=", "crm.lead"], ["res_id", "=", leadId]]],
    {
      fields: [
        "id", "activity_type_id", "summary", "note", "date_deadline",
        "user_id", "res_id", "res_model", "state", "create_date",
      ],
      order: "date_deadline asc",
    }
  );
}

/**
 * Fetch messages/chatter for a CRM lead
 */
export async function fetchCrmMessages(leadId: number, limit = 20): Promise<CrmMessage[]> {
  return executeKw<CrmMessage[]>(
    "mail.message",
    "search_read",
    [[["model", "=", "crm.lead"], ["res_id", "=", leadId]]],
    {
      fields: ["id", "body", "author_id", "date", "message_type", "subtype_id"],
      order: "date desc",
      limit,
    }
  );
}

/**
 * Move a CRM lead to a different stage
 */
export async function moveCrmLeadToStage(leadId: number, stageId: number): Promise<boolean> {
  return executeKw<boolean>(
    "crm.lead",
    "write",
    [[leadId], { stage_id: stageId }]
  );
}

/**
 * Update CRM lead fields
 */
export async function updateCrmLead(
  leadId: number,
  values: Record<string, unknown>
): Promise<boolean> {
  return executeKw<boolean>(
    "crm.lead",
    "write",
    [[leadId], values]
  );
}

/**
 * Add a note/log to a CRM lead
 */
export async function addCrmLeadNote(leadId: number, body: string): Promise<number> {
  return executeKw<number>(
    "mail.message",
    "create",
    [{
      model: "crm.lead",
      res_id: leadId,
      body,
      message_type: "comment",
      subtype_xmlid: "mail.mt_note",
    }]
  );
}

/**
 * Create a new CRM lead (investment deal)
 */
export async function createCrmLead(values: {
  name: string;
  partner_id?: number;
  contact_name?: string;
  email_from?: string;
  phone?: string;
  expected_revenue?: number;
  probability?: number;
  priority?: string;
  date_deadline?: string;
  description?: string;
  stage_id?: number;
  tag_ids?: number[];
  company_id?: number;
  type?: string;
}): Promise<number> {
  const vals: Record<string, unknown> = {
    name: values.name,
    type: values.type || "opportunity",
    company_id: values.company_id || ABU_DHABI_COMPANY_ID,
  };
  if (values.partner_id) vals.partner_id = values.partner_id;
  if (values.contact_name) vals.contact_name = values.contact_name;
  if (values.email_from) vals.email_from = values.email_from;
  if (values.phone) vals.phone = values.phone;
  if (values.expected_revenue !== undefined) vals.expected_revenue = values.expected_revenue;
  if (values.probability !== undefined) vals.probability = values.probability;
  if (values.priority) vals.priority = values.priority;
  if (values.date_deadline) vals.date_deadline = values.date_deadline;
  if (values.description) vals.description = values.description;
  if (values.stage_id) vals.stage_id = values.stage_id;
  if (values.tag_ids && values.tag_ids.length > 0) vals.tag_ids = [[6, 0, values.tag_ids]];

  return executeKw<number>("crm.lead", "create", [vals]);
}

/**
 * Search partners (investors/contacts) by name
 */
export async function searchPartners(
  query: string,
  limit = 20
): Promise<{ id: number; name: string; email: string | false; phone: string | false; company_name: string | false }[]> {
  const domain: any[] = [];
  if (query.trim()) {
    domain.push("|", "|",
      ["name", "ilike", query],
      ["email", "ilike", query],
      ["phone", "ilike", query]
    );
  }
  return executeKw<any[]>(
    "res.partner",
    "search_read",
    [domain],
    {
      fields: ["id", "name", "email", "phone", "company_name"],
      limit,
      order: "name asc",
    }
  );
}

/**
 * Create a new partner (investor/contact) in Odoo
 */
export async function createPartner(
  data: { name: string; email?: string; phone?: string; company_name?: string }
): Promise<number> {
  return executeKw<number>(
    "res.partner",
    "create",
    [{
      name: data.name,
      ...(data.email ? { email: data.email } : {}),
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.company_name ? { company_name: data.company_name } : {}),
      customer_rank: 1,
    }]
  );
}

/**
 * Upload an attachment to a CRM lead
 */
export async function uploadLeadAttachment(leadId: number, filename: string, data: string, mimetype?: string): Promise<number> {
  return executeKw<number>(
    "ir.attachment",
    "create",
    [{
      name: filename,
      datas: data, // base64 encoded
      res_model: "crm.lead",
      res_id: leadId,
      mimetype: mimetype || "application/octet-stream",
    }]
  );
}

/**
 * Fetch attachments for a CRM lead
 */
export async function fetchLeadAttachments(leadId: number): Promise<{ id: number; name: string; mimetype: string; file_size: number; create_date: string }[]> {
  return executeKw<any[]>(
    "ir.attachment",
    "search_read",
    [["&", ["res_model", "=", "crm.lead"], ["res_id", "=", leadId]]],
    {
      fields: ["id", "name", "mimetype", "file_size", "create_date"],
      order: "create_date desc",
    }
  );
}

/**
 * Get pipeline summary (count + revenue per stage)
 */
export async function getCrmPipelineSummary(companyId?: number): Promise<{
  stages: CrmStage[];
  leads: CrmLead[];
  summary: { stageId: number; stageName: string; count: number; revenue: number }[];
}> {
  const [stages, leads] = await Promise.all([
    fetchCrmStages(),
    fetchCrmLeads(companyId),
  ]);

  const summary = stages.map(stage => {
    const stageLeads = leads.filter(l => l.stage_id && l.stage_id[0] === stage.id);
    return {
      stageId: stage.id,
      stageName: stage.name,
      count: stageLeads.length,
      revenue: stageLeads.reduce((sum, l) => sum + (l.expected_revenue || 0), 0),
    };
  });

  return { stages, leads, summary };
}
