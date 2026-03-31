import { HuiYunYingClient } from "@/backend/integrations/huiyunying/huiyunying-client";
import type {
  HuiYunYingCreateRectificationInput,
  HuiYunYingListRectificationInput,
  HuiYunYingRectificationOrderItem
} from "@/backend/integrations/huiyunying/huiyunying.types";

export class HuiYunYingRectificationService {
  constructor(private readonly client: HuiYunYingClient) {}

  async createRectificationOrder(input: HuiYunYingCreateRectificationInput): Promise<unknown> {
    return this.client.createRectificationOrder(input);
  }

  async listRectificationOrders(
    input: HuiYunYingListRectificationInput
  ): Promise<HuiYunYingRectificationOrderItem[]> {
    return this.client.listRectificationOrders(input);
  }
}
