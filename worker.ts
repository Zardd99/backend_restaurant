import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "./config/db";
import { setupDependencies, DependencyContainer } from "./config/dependencies";
import { orderTimeoutService } from "./services/OrderTimeoutService";
import { kdsPacingService } from "./services/KdsPacingService";
import { BirthdayReminderService } from "./services/BirthdayReminderService";
import { EmailService } from "./services/email-service";
import { withRedisLock } from "./utils/redisLock";
import { redis } from "./config/redis";
import { emitSocketEvent } from "./utils/socketEmitter";
import { Result } from "./shared/result";

dotenv.config();

/**
 * Standalone background worker.
 *
 * Owns the scheduled jobs that previously ran inside the web process. Every
 * tick is wrapped in a distributed Redis lock so that running multiple worker
 * replicas (or an accidental web+worker overlap) still executes each job
 * exactly once per interval.
 */

interface InventoryManagerRunner {
  checkAndAlertLowStock: () => Promise<
    Result<{
      lowStockCount: number;
      criticalStockCount: number;
      emailsSent: number;
      notificationsCreated: number;
    }>
  >;
}

const TICK_MS = 60_000;
const LOCK_TTL_MS = TICK_MS - 5_000;

// Hour of day (local time, 0-23) at which the daily birthday sweep fires.
const BIRTHDAY_HOUR = parseInt(process.env.BIRTHDAY_REMINDER_HOUR || "8", 10);
// Once-per-day claim TTL — long enough to outlast the fire window, short
// enough that the next calendar day always gets a fresh claim.
const BIRTHDAY_CLAIM_TTL_SECONDS = 23 * 60 * 60;

const timers: NodeJS.Timeout[] = [];
let shuttingDown = false;

async function runLowStockTick(
  inventoryManager: InventoryManagerRunner,
): Promise<void> {
  await withRedisLock("job:low-stock-alerts", LOCK_TTL_MS, async () => {
    const result = await inventoryManager.checkAndAlertLowStock();
    if (!result.success) {
      console.error("Low-stock alert job failed:", result.error.message);
    }
  });
}

async function runOrderTimeoutTick(): Promise<void> {
  await withRedisLock("job:order-timeout", LOCK_TTL_MS, async () => {
    const cancelled = await orderTimeoutService.checkAndCancelTimedOutOrders();
    const failedSteps = await orderTimeoutService.checkTimedOutPrepSteps();
    if (cancelled > 0 || failedSteps > 0) {
      console.log(
        `Order timeout job: cancelled ${cancelled} orders, failed ${failedSteps} steps`,
      );
    }
  });
}

async function runKdsPacingTick(): Promise<void> {
  await withRedisLock("job:kds-pacing", LOCK_TTL_MS, async () => {
    const fired = await kdsPacingService.checkAndFirePacedItems();
    if (fired > 0) {
      console.log(`KDS pacing job: fired held items on ${fired} tickets`);
    }
  });
}

async function runBirthdayReminderTick(
  birthdayService: BirthdayReminderService,
): Promise<void> {
  const now = new Date();
  if (now.getHours() !== BIRTHDAY_HOUR) return;

  await withRedisLock("job:birthday-reminders", LOCK_TTL_MS, async () => {
    // Claim today's run exactly once across all replicas and ticks within the
    // fire window. Local date string keeps the claim aligned to the calendar.
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const claim = await redis.set(
      `job:birthday-reminders:sent:${dateKey}`,
      "1",
      { nx: true, ex: BIRTHDAY_CLAIM_TTL_SECONDS },
    );
    if (claim !== "OK") return;

    const result = await birthdayService.sendBirthdayReminders(now);
    if (result.celebrants > 0) {
      // Push live toasts to connected clients via the Redis socket emitter.
      // Reuses the generic order:notification channel the frontend subscribes
      // to; a no-op when UPSTASH_REDIS_URL is unset.
      for (const notification of result.notifications) {
        emitSocketEvent("order:notification", notification);
      }
      console.log(
        `Birthday reminder job: ${result.celebrants} celebrant(s), ` +
          `${result.notificationsCreated} notification(s), ` +
          `emailed ${result.recipients} recipient(s) (sent=${result.emailsSent})`,
      );
    }
  });
}

function schedule(task: () => Promise<void>): void {
  const timer = setInterval(() => {
    task().catch((error) => {
      console.error("Scheduled task error:", error);
    });
  }, TICK_MS);
  timers.push(timer);
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Stopping worker...`);

  for (const timer of timers) {
    clearInterval(timer);
  }

  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.close(false);
      console.log("Worker database connection closed.");
    } catch (error) {
      console.error("Error closing worker database connection:", error);
    }
  }

  console.log("Worker shutdown complete.");
  process.exit(0);
}

async function main(): Promise<void> {
  await connectDB();

  try {
    setupDependencies();
  } catch (error) {
    console.error("Critical Failure: Dependency setup failed", error);
    process.exit(1);
  }

  const container = DependencyContainer.getInstance();
  const inventoryManager = container.resolve(
    "InventoryManager",
  ) as InventoryManagerRunner;
  const emailService = container.resolve<EmailService>("EmailService");
  const birthdayService = new BirthdayReminderService(emailService);

  schedule(() => runLowStockTick(inventoryManager));
  schedule(() => runOrderTimeoutTick());
  schedule(() => runKdsPacingTick());
  schedule(() => runBirthdayReminderTick(birthdayService));

  console.log(
    `Worker started. Scheduled jobs running every ${TICK_MS / 1000}s with Redis locks.`,
  );
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
