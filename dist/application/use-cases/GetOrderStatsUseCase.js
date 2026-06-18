"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetOrderStatsUseCase = void 0;
class GetOrderStatsUseCase {
    constructor(statsManager) {
        this.statsManager = statsManager;
    }
    async execute() {
        return this.statsManager.getOrderStats();
    }
}
exports.GetOrderStatsUseCase = GetOrderStatsUseCase;
//# sourceMappingURL=GetOrderStatsUseCase.js.map