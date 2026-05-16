import { MasterDataService } from "@/backend/master-data/master-data.service";
import { PgMasterDataRepository } from "@/backend/master-data/pg-master-data.repository";

export function createMasterDataService(): any {
  return new MasterDataService(new PgMasterDataRepository());
}
