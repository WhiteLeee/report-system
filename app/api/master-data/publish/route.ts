import { createMasterDataService } from "@/backend/master-data/master-data.module";
import { masterDataPublishSchema } from "@/backend/master-data/master-data.schema";

const masterDataService = createMasterDataService();

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Request body must be valid JSON."
      },
      { status: 400 }
    );
  }

  const parsed = masterDataPublishSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Invalid master-data publish payload.",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  try {
    const result = masterDataService.publishSnapshot(parsed.data);
    return Response.json(
      {
        ok: true,
        sync_batch_id: result.syncBatchId,
        enterprise_id: result.enterpriseId,
        snapshot_version: result.snapshotVersion,
        organize_count: result.organizeCount,
        store_count: result.storeCount,
        action: result.action,
        received_at: result.receivedAt
      },
      { status: result.action === "created" ? 201 : 200 }
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Failed to persist master-data snapshot.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
