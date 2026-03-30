import type { RequestContext } from "@/backend/auth/request-context";

export interface MasterDataOrganizationPayload {
  organize_code: string;
  organize_name: string;
  parent_code?: string;
  level?: number;
  raw_json?: Record<string, unknown>;
}

export interface MasterDataStorePayload {
  store_id: string;
  store_code?: string;
  store_name: string;
  organize_code?: string;
  organize_name?: string;
  store_type?: string;
  franchisee_name?: string;
  supervisor?: string;
  status?: string;
  raw_json?: Record<string, unknown>;
}

export interface MasterDataPublishPayload {
  source_system: string;
  payload_version: number;
  data_type: "store_master";
  idempotency_key: string;
  published_at: string;
  snapshot_mode: "full_replace";
  enterprise: {
    enterprise_id: string;
    enterprise_name: string;
  };
  snapshot_meta: {
    snapshot_version: string;
    organize_count: number;
    store_count: number;
    operator?: string;
  };
  organizations: MasterDataOrganizationPayload[];
  stores: MasterDataStorePayload[];
}

export interface MasterDataPublishReceipt {
  ok: true;
  action: "created" | "duplicate";
  syncBatchId: string;
  enterpriseId: string;
  snapshotVersion: string;
  organizeCount: number;
  storeCount: number;
  receivedAt: string;
}

export interface MasterDataEnterpriseSummary {
  enterprise_id: string;
  enterprise_name: string;
  latest_snapshot_version: string;
  latest_published_at: string;
  organize_count: number;
  store_count: number;
}

export interface MasterDataOrganization {
  organize_code: string;
  organize_name: string;
  parent_code: string;
  level: number;
  is_active: boolean;
  current_store_count: number;
  raw_json: Record<string, unknown>;
  child: MasterDataOrganization[];
}

export interface MasterDataStore {
  store_id: string;
  store_code: string;
  store_name: string;
  organize_code: string;
  organize_name: string;
  store_type: string;
  franchisee_name: string;
  supervisor: string;
  status: string;
  is_active: boolean;
  snapshot_version: string;
  employee_name: string;
  employee_code: string;
  emp_count: number;
  business_status: string;
  food_status: string;
  store_address: string;
  raw_json: Record<string, unknown>;
}

export interface MasterDataSyncLog {
  sync_batch_id: string;
  idempotency_key: string;
  enterprise_id: string;
  enterprise_name: string;
  snapshot_version: string;
  organize_count: number;
  store_count: number;
  status: string;
  published_at: string;
  created_at: string;
}

export interface MasterDataStoreFilters {
  enterpriseId: string;
  organizeCode?: string;
  keyword?: string;
  status?: string;
}

export interface MasterDataRepository {
  publishSnapshot(payload: MasterDataPublishPayload, context?: RequestContext): MasterDataPublishReceipt;
  listEnterprises(context?: RequestContext): MasterDataEnterpriseSummary[];
  listOrganizations(enterpriseId: string, context?: RequestContext): MasterDataOrganization[];
  listStores(filters: MasterDataStoreFilters, context?: RequestContext): MasterDataStore[];
  listSyncLogs(enterpriseId: string, limit?: number, context?: RequestContext): MasterDataSyncLog[];
}
