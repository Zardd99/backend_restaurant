import mongoose from "mongoose";
import dotenv from "dotenv";
import Table, { TableSection } from "../models/Table";

dotenv.config();

interface SeedTable {
  tableNumber: string;
  capacity: number;
  section: TableSection;
}

const tables: SeedTable[] = [
  // Indoor — the bulk of the floor
  { tableNumber: "1", capacity: 2, section: "indoor" },
  { tableNumber: "2", capacity: 2, section: "indoor" },
  { tableNumber: "3", capacity: 4, section: "indoor" },
  { tableNumber: "4", capacity: 4, section: "indoor" },
  { tableNumber: "5", capacity: 4, section: "indoor" },
  { tableNumber: "6", capacity: 6, section: "indoor" },
  { tableNumber: "7", capacity: 6, section: "indoor" },
  { tableNumber: "8", capacity: 8, section: "indoor" },
  // Patio
  { tableNumber: "P1", capacity: 2, section: "patio" },
  { tableNumber: "P2", capacity: 4, section: "patio" },
  { tableNumber: "P3", capacity: 4, section: "patio" },
  { tableNumber: "P4", capacity: 6, section: "patio" },
  // Bar
  { tableNumber: "B1", capacity: 1, section: "bar" },
  { tableNumber: "B2", capacity: 1, section: "bar" },
  { tableNumber: "B3", capacity: 2, section: "bar" },
  { tableNumber: "B4", capacity: 2, section: "bar" },
  // VIP
  { tableNumber: "VIP-1", capacity: 8, section: "vip" },
  { tableNumber: "VIP-2", capacity: 12, section: "vip" },
];

async function seedTables() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant",
  );

  let created = 0;
  for (const table of tables) {
    const result = await Table.updateOne(
      { tableNumber: table.tableNumber },
      {
        $setOnInsert: {
          ...table,
          status: "vacant",
          currentGuestCount: 0,
          joinedWith: [],
          currentOrderId: null,
          reservationTime: null,
          vacantSince: new Date(),
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount > 0) created += 1;
  }

  console.log(
    `Seed complete: ${created} new table(s), ${tables.length - created} already existed.`,
  );
  await mongoose.disconnect();
}

seedTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed tables:", error);
    process.exit(1);
  });
