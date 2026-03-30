import { z } from "zod";

export const masterDataOrganizationSchema = z.object({
  organize_code: z.string().trim().min(1),
  organize_name: z.string().trim().min(1),
  parent_code: z.string().trim().optional().default(""),
  level: z.coerce.number().int().min(0).optional().default(0),
  raw_json: z.record(z.string(), z.unknown()).optional().default({})
});

export const masterDataStoreSchema = z.object({
  store_id: z.string().trim().min(1),
  store_code: z.string().trim().optional().default(""),
  store_name: z.string().trim().min(1),
  organize_code: z.string().trim().optional().default(""),
  organize_name: z.string().trim().optional().default(""),
  store_type: z.string().trim().optional().default(""),
  franchisee_name: z.string().trim().optional().default(""),
  supervisor: z.string().trim().optional().default(""),
  status: z.string().trim().optional().default(""),
  raw_json: z.record(z.string(), z.unknown()).optional().default({})
});

export const masterDataPublishSchema = z.object({
  source_system: z.string().trim().min(1),
  payload_version: z.coerce.number().int().min(1),
  data_type: z.literal("store_master"),
  idempotency_key: z.string().trim().min(1),
  published_at: z.string().trim().min(1),
  snapshot_mode: z.literal("full_replace"),
  enterprise: z.object({
    enterprise_id: z.string().trim().min(1),
    enterprise_name: z.string().trim().min(1)
  }),
  snapshot_meta: z.object({
    snapshot_version: z.string().trim().min(1),
    organize_count: z.coerce.number().int().min(0),
    store_count: z.coerce.number().int().min(0),
    operator: z.string().trim().optional().default("")
  }),
  organizations: z.array(masterDataOrganizationSchema),
  stores: z.array(masterDataStoreSchema)
});
