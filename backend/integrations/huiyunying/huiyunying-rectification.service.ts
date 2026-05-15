import { HuiYunYingClient } from "@/backend/integrations/huiyunying/huiyunying-client";
import type {
  HuiYunYingCreateRectificationInput,
  HuiYunYingListRectificationInput,
  HuiYunYingRectificationOrderItem
} from "@/backend/integrations/huiyunying/huiyunying.types";

export class HuiYunYingRectificationService {
  constructor(private readonly client: HuiYunYingClient) {}

  async createRectificationOrder(input: HuiYunYingCreateRectificationInput): Promise<any> {
    return this.client.createRectificationOrder(input);
  }

  async listRectificationOrders(
    input: HuiYunYingListRectificationInput
  ): Promise<any> {
    return this.client.listRectificationOrders(input);
  }
}
