import { SqliteRectificationOrderRepository } from "@/backend/rectification/sqlite-rectification.repository";
import { RectificationService } from "@/backend/rectification/rectification.service";

export function createRectificationOrderRepository(): SqliteRectificationOrderRepository {
  return new SqliteRectificationOrderRepository();
}

export function createRectificationService(): RectificationService {
  return new RectificationService(createRectificationOrderRepository());
}
