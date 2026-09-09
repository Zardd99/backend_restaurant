"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = __importDefault(require("./config/db"));
const dependencies_1 = require("./config/dependencies");
const OrderTimeoutService_1 = require("./services/OrderTimeoutService");
const KdsPacingService_1 = require("./services/KdsPacingService");
const BirthdayReminderService_1 = require("./services/BirthdayReminderService");
const redisLock_1 = require("./utils/redisLock");
const redis_1 = require("./config/redis");
const socketEmitter_1 = require("./utils/socketEmitter");
dotenv_1.default.config();
const TICK_MS = 60000;
const LOCK_TTL_MS = TICK_MS - 5000;
const BIRTHDAY_HOUR = parseInt(process.env.BIRTHDAY_REMINDER_HOUR || "8", 10);
const BIRTHDAY_CLAIM_TTL_SECONDS = 23 * 60 * 60;
const timers = [];
let shuttingDown = false;
async function runLowStockTick(inventoryManager) {
    await (0, redisLock_1.withRedisLock)("job:low-stock-alerts", LOCK_TTL_MS, async () => {
        const result = await inventoryManager.checkAndAlertLowStock();
        if (!result.success) {
            console.error("Low-stock alert job failed:", result.error.message);
        }
    });
}
async function runOrderTimeoutTick() {
    await (0, redisLock_1.withRedisLock)("job:order-timeout", LOCK_TTL_MS, async () => {
        const cancelled = await OrderTimeoutService_1.orderTimeoutService.checkAndCancelTimedOutOrders();
        const failedSteps = await OrderTimeoutService_1.orderTimeoutService.checkTimedOutPrepSteps();
        if (cancelled > 0 || failedSteps > 0) {
            console.log(`Order timeout job: cancelled ${cancelled} orders, failed ${failedSteps} steps`);
        }
    });
}
async function runKdsPacingTick() {
    await (0, redisLock_1.withRedisLock)("job:kds-pacing", LOCK_TTL_MS, async () => {
        const fired = await KdsPacingService_1.kdsPacingService.checkAndFirePacedItems();
        if (fired > 0) {
            console.log(`KDS pacing job: fired held items on ${fired} tickets`);
        }
    });
}
async function runBirthdayReminderTick(birthdayService) {
    const now = new Date();
    if (now.getHours() !== BIRTHDAY_HOUR)
        return;
    await (0, redisLock_1.withRedisLock)("job:birthday-reminders", LOCK_TTL_MS, async () => {
        const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        const claim = await redis_1.redis.set(`job:birthday-reminders:sent:${dateKey}`, "1", { nx: true, ex: BIRTHDAY_CLAIM_TTL_SECONDS });
        if (claim !== "OK")
            return;
        const result = await birthdayService.sendBirthdayReminders(now);
        if (result.celebrants > 0) {
            for (const notification of result.notifications) {
                (0, socketEmitter_1.emitSocketEvent)("order:notification", notification);
            }
            console.log(`Birthday reminder job: ${result.celebrants} celebrant(s), ` +
                `${result.notificationsCreated} notification(s), ` +
                `emailed ${result.recipients} recipient(s) (sent=${result.emailsSent})`);
        }
    });
}
function schedule(task) {
    const timer = setInterval(() => {
        task().catch((error) => {
            console.error("Scheduled task error:", error);
        });
    }, TICK_MS);
    timers.push(timer);
}
async function shutdown(signal) {
    if (shuttingDown)
        return;
    shuttingDown = true;
    console.log(`${signal} received. Stopping worker...`);
    for (const timer of timers) {
        clearInterval(timer);
    }
    if (mongoose_1.default.connection.readyState === 1) {
        try {
            await mongoose_1.default.connection.close(false);
            console.log("Worker database connection closed.");
        }
        catch (error) {
            console.error("Error closing worker database connection:", error);
        }
    }
    console.log("Worker shutdown complete.");
    process.exit(0);
}
async function main() {
    await (0, db_1.default)();
    try {
        (0, dependencies_1.setupDependencies)();
    }
    catch (error) {
        console.error("Critical Failure: Dependency setup failed", error);
        process.exit(1);
    }
    const container = dependencies_1.DependencyContainer.getInstance();
    const inventoryManager = container.resolve("InventoryManager");
    const emailService = container.resolve("EmailService");
    const birthdayService = new BirthdayReminderService_1.BirthdayReminderService(emailService);
    schedule(() => runLowStockTick(inventoryManager));
    schedule(() => runOrderTimeoutTick());
    schedule(() => runKdsPacingTick());
    schedule(() => runBirthdayReminderTick(birthdayService));
    console.log(`Worker started. Scheduled jobs running every ${TICK_MS / 1000}s with Redis locks.`);
}
process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
    void shutdown("SIGINT");
});
main().catch((error) => {
    console.error("Worker failed to start:", error);
    process.exit(1);
});
//# sourceMappingURL=worker.js.map