import { Result } from "../../core/Result";
import { StatsManager } from "../../domain/managers/StatsManager";

export class GetOrderStatsUseCase {
  constructor(private statsManager: StatsManager) {}

  async execute(): Promise<Result<any, string>> {
    return this.statsManager.getOrderStats();
  }
}
