import type { RequestContext } from "@/backend/auth/request-context";
import type {
  MasterDataEnterpriseSummary,
  MasterDataOrganization,
  MasterDataPublishPayload,
  MasterDataPublishReceipt,
  MasterDataRepository,
  MasterDataStore,
  MasterDataStoreFilters,
  MasterDataSyncLog
} from "@/backend/master-data/master-data.types";

export class MasterDataService {
  constructor(private readonly repository: MasterDataRepository) {}

  publishSnapshot(payload: MasterDataPublishPayload, context: RequestContext = {}): MasterDataPublishReceipt {
    return this.repository.publishSnapshot(payload, context);
  }

  listEnterprises(context: RequestContext = {}): MasterDataEnterpriseSummary[] {
    return this.repository.listEnterprises(context);
  }

  listOrganizations(enterpriseId: string, context: RequestContext = {}): MasterDataOrganization[] {
    return this.repository.listOrganizations(enterpriseId.trim(), context);
  }

  listStores(filters: MasterDataStoreFilters, context: RequestContext = {}): MasterDataStore[] {
    return this.repository.listStores(
      {
        enterpriseId: filters.enterpriseId.trim(),
        organizeCode: filters.organizeCode?.trim() ?? "",
        keyword: filters.keyword?.trim() ?? "",
        status: filters.status?.trim() ?? ""
      },
      context
    );
  }

  listSyncLogs(enterpriseId: string, limit = 10, context: RequestContext = {}): MasterDataSyncLog[] {
    return this.repository.listSyncLogs(enterpriseId.trim(), limit, context);
  }
}
