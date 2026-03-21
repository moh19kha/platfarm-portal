/**
 * CRM Router — Investment Cycles Management
 * 
 * Exposes Odoo CRM data (Abu Dhabi company) as tRPC procedures
 * for the Investors Relationship Management module.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  fetchCrmStages,
  fetchCrmLeads,
  fetchCrmLeadById,
  fetchCrmTags,
  fetchCrmActivities,
  fetchCrmMessages,
  moveCrmLeadToStage,
  updateCrmLead,
  addCrmLeadNote,
  getCrmPipelineSummary,
  createCrmLead,
  searchPartners,
  createPartner,
  uploadLeadAttachment,
  fetchLeadAttachments,
} from "../odoo-crm";

export const crmRouter = router({
  /** Get all CRM pipeline stages */
  stages: publicProcedure.query(async () => {
    return fetchCrmStages();
  }),

  /** Get CRM leads (investment deals) with optional filters */
  leads: publicProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        stageId: z.number().optional(),
        limit: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return fetchCrmLeads(input?.companyId, input?.stageId, input?.limit);
    }),

  /** Get a single CRM lead by ID */
  leadById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return fetchCrmLeadById(input.id);
    }),

  /** Get CRM tags */
  tags: publicProcedure.query(async () => {
    return fetchCrmTags();
  }),

  /** Get activities for a lead */
  activities: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      return fetchCrmActivities(input.leadId);
    }),

  /** Get messages/chatter for a lead */
  messages: publicProcedure
    .input(z.object({ leadId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return fetchCrmMessages(input.leadId, input.limit);
    }),

  /** Move a lead to a different stage */
  moveToStage: publicProcedure
    .input(z.object({ leadId: z.number(), stageId: z.number() }))
    .mutation(async ({ input }) => {
      return moveCrmLeadToStage(input.leadId, input.stageId);
    }),

  /** Update lead fields */
  updateLead: publicProcedure
    .input(
      z.object({
        leadId: z.number(),
        values: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ input }) => {
      return updateCrmLead(input.leadId, input.values);
    }),

  /** Add a note to a lead */
  addNote: publicProcedure
    .input(z.object({ leadId: z.number(), body: z.string() }))
    .mutation(async ({ input }) => {
      return addCrmLeadNote(input.leadId, input.body);
    }),

  /** Get pipeline summary (stages + counts + revenue) */
  pipelineSummary: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return getCrmPipelineSummary(input?.companyId);
    }),

  /** Create a new CRM lead (investment deal) */
  createLead: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Deal name is required"),
        partner_id: z.number().optional(),
        contact_name: z.string().optional(),
        email_from: z.string().optional(),
        phone: z.string().optional(),
        expected_revenue: z.number().optional(),
        probability: z.number().min(0).max(100).optional(),
        priority: z.string().optional(),
        date_deadline: z.string().optional(),
        description: z.string().optional(),
        stage_id: z.number().optional(),
        tag_ids: z.array(z.number()).optional(),
        company_id: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const leadId = await createCrmLead(input);
      return { id: leadId, success: true };
    }),

  /** Search partners (investors/contacts) */
  searchPartners: publicProcedure
    .input(z.object({ query: z.string(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return searchPartners(input.query, input.limit);
    }),

  /** Create a new partner (investor/contact) in Odoo */
  createPartner: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().optional(),
      phone: z.string().optional(),
      companyName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const partnerId = await createPartner({
        name: input.name,
        email: input.email,
        phone: input.phone,
        company_name: input.companyName,
      });
      return { id: partnerId, name: input.name, success: true };
    }),

  /** Upload attachment to a CRM lead */
  uploadAttachment: publicProcedure
    .input(
      z.object({
        leadId: z.number(),
        filename: z.string(),
        data: z.string(), // base64
        mimetype: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const attachmentId = await uploadLeadAttachment(
        input.leadId,
        input.filename,
        input.data,
        input.mimetype
      );
      return { id: attachmentId, success: true };
    }),

  /** Get attachments for a CRM lead */
  leadAttachments: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      return fetchLeadAttachments(input.leadId);
    }),
});
