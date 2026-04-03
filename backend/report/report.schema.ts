import { z } from "zod";

export const incomingResultReviewStateSchema = z.enum(["pending", "completed", "pending_review", "reviewed"]);

const jsonLiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type JsonLiteral = z.infer<typeof jsonLiteralSchema>;
type Json = JsonLiteral | { [key: string]: Json } | Json[];

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([jsonLiteralSchema, z.array(jsonSchema), z.record(z.string(), jsonSchema)])
);

const reportMetaSchema = z.object({
  report_type: z.string().trim().optional().default("daily"),
  topic: z.string().trim().min(1),
  plan_id: z.string().trim().optional().default(""),
  plan_name: z.string().trim().optional().default(""),
  report_versions: z.array(z.string().trim().min(1)).default([]),
  enterprise_id: z.string().trim().min(1),
  enterprise_name: z.string().trim().min(1),
  start_date: z.string().trim().min(1),
  end_date: z.string().trim().min(1),
  operator: z.string().trim().min(1),
  generated_at: z.string().trim().min(1)
});

const summarySchema = z.object({
  metrics: z.record(z.string(), jsonSchema).default({}),
  trend: jsonSchema.optional(),
  issue_distribution: jsonSchema.optional()
});

const storeFactSchema = z.object({
  store_id: z.string().trim().min(1),
  store_code: z.string().trim().optional(),
  store_name: z.string().trim().min(1),
  organize_code: z.string().trim().optional(),
  organize_name: z.string().trim().optional(),
  store_type: z.string().trim().optional(),
  franchisee_name: z.string().trim().optional(),
  supervisor: z.string().trim().optional(),
  enterprise_id: z.string().trim().optional(),
  enterprise_name: z.string().trim().optional()
});

const cameraFactSchema = z.object({
  camera_id: z.string().trim().min(1),
  store_id: z.string().trim().min(1),
  store_code: z.string().trim().optional(),
  store_name: z.string().trim().optional(),
  camera_index: z.number().int().nonnegative().optional(),
  camera_alias: z.string().trim().optional(),
  camera_device_code: z.string().trim().optional()
});

const captureFactSchema = z.object({
  capture_id: z.string().trim().min(1),
  image_id: z.string().trim().min(1),
  store_id: z.string().trim().min(1),
  store_code: z.string().trim().optional(),
  store_name: z.string().trim().optional(),
  camera_id: z.string().trim().optional(),
  camera_index: z.number().int().nonnegative().optional(),
  camera_alias: z.string().trim().optional(),
  camera_device_code: z.string().trim().optional(),
  capture_provider: z.string().trim().optional(),
  channel_code: z.string().trim().optional(),
  captured_at: z.string().trim().optional(),
  capture_url: z.string().trim().optional(),
  preview_url: z.string().trim().optional(),
  oss_key: z.string().trim().optional(),
  local_path: z.string().trim().optional(),
  issue_count: z.number().int().nonnegative().optional()
});

const inspectionFactSchema = z.object({
  inspection_id: z.string().trim().min(1),
  capture_id: z.string().trim().min(1),
  image_id: z.string().trim().min(1),
  store_id: z.string().trim().min(1),
  store_code: z.string().trim().optional(),
  store_name: z.string().trim().optional(),
  skill_id: z.string().trim().min(1),
  skill_name: z.string().trim().optional(),
  status: z.string().trim().optional(),
  channel_code: z.string().trim().optional(),
  capture_provider: z.string().trim().optional(),
  raw_result: z.string().trim().optional(),
  error_message: z.string().trim().optional(),
  total_issues: z.number().int().nonnegative().optional()
});

const issueFactSchema = z.object({
  issue_id: z.string().trim().min(1),
  inspection_id: z.string().trim().min(1),
  capture_id: z.string().trim().min(1),
  image_id: z.string().trim().min(1),
  store_id: z.string().trim().min(1),
  store_code: z.string().trim().optional(),
  store_name: z.string().trim().optional(),
  skill_id: z.string().trim().optional(),
  skill_name: z.string().trim().optional(),
  issue_type: z.string().trim().optional(),
  description: z.string().trim().optional(),
  count: z.number().int().nonnegative().optional(),
  severity: z.string().trim().optional(),
  review_status: incomingResultReviewStateSchema.optional(),
  extra_json: jsonSchema.optional()
});

export const reportPublishSchema = z.object({
  source_system: z.string().trim().min(1).default("vision-agent"),
  payload_version: z.number().int().positive(),
  idempotency_key: z.string().trim().min(1),
  published_at: z.string().trim().min(1),
  publish_dir: z.string().trim().optional(),
  report: z.object({
    report_meta: reportMetaSchema,
    summary: summarySchema.default({ metrics: {} }),
    facts: z.object({
      stores: z.array(storeFactSchema).default([]),
      cameras: z.array(cameraFactSchema).default([]),
      captures: z.array(captureFactSchema).default([]),
      inspections: z.array(inspectionFactSchema).default([]),
      issues: z.array(issueFactSchema).default([])
    })
  })
});

export type ReportPublishSchema = z.infer<typeof reportPublishSchema>;
