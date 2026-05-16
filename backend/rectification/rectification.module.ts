import { PgRectificationOrderRepository } from "@/backend/rectification/pg-rectification.repository";
import { RectificationService } from "@/backend/rectification/rectification.service";

export function createRectificationOrderRepository(): any {
  return new PgRectificationOrderRepository();
}

export function createRectificationService(): any {
  return new RectificationService(createRectificationOrderRepository());
}
