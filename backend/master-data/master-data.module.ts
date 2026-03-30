import { MasterDataService } from "@/backend/master-data/master-data.service";
import { SqliteMasterDataRepository } from "@/backend/master-data/sqlite-master-data.repository";

export function createMasterDataService(): MasterDataService {
  return new MasterDataService(new SqliteMasterDataRepository());
}
