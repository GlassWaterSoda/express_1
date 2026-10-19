import pool from "./data/data.js";
import { writeFile } from "node:fs/promises";

const get_all_order = async () => {
  const order = await pool.query(
    "SELECT id, customer, total, status, created_at FROM orders ORDER BY id;",
  );
  return order.rows;
};

let records: unknown[];

try {
  records = await get_all_order();
} finally {
  await pool.end();
}

interface Order {
  id: number;
  customer: string;
  total: number;
  status: "PAID" | "PENDING" | "REFUNDED";
  created_at: string;
}

// PostgreSQL returns NUMERIC as a string and timestamps as Date objects.
// Keep those raw database types separate from the normalized Order below.
interface RawOrder {
  id: number;
  customer: string;
  total: number | string;
  status: Order["status"];
  created_at: Date | string;
}

function isOrder(value: unknown): value is RawOrder {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const order = value as Record<string, unknown>;
  // Validate both number and numeric-string totals from the database driver.
  const validTotal =
    (typeof order.total === "number" && Number.isFinite(order.total)) ||
    (typeof order.total === "string" &&
      order.total.trim() !== "" &&
      Number.isFinite(Number(order.total)));
  // Accept valid Date objects from pg as well as timestamp strings.
  const validCreatedAt =
    (order.created_at instanceof Date &&
      Number.isFinite(order.created_at.getTime())) ||
    (typeof order.created_at === "string" &&
      order.created_at.trim() !== "" &&
      !Number.isNaN(Date.parse(order.created_at)));

  return (
    typeof order.id === "number" &&
    typeof order.customer === "string" &&
    validTotal &&
    (order.status === "PAID" ||
      order.status === "PENDING" ||
      order.status === "REFUNDED") &&
    validCreatedAt
  );
}

function normalizeOrder(order: RawOrder): Order {
  // Convert database values to the stable types used by the report.
  return {
    ...order,
    total: Number(order.total),
    created_at:
      order.created_at instanceof Date
        ? order.created_at.toISOString()
        : new Date(order.created_at).toISOString(),
  };
}

const validOrders: Order[] = [];
let invalidCount = 0;

for (const order of records as unknown[]) {
  if (isOrder(order)) {
    validOrders.push(normalizeOrder(order));
  } else {
    invalidCount++;
  }
}

const arg = process.argv[2];
const minTotal = arg === undefined ? 50 : Number(arg);

if (Number.isNaN(minTotal)) {
  console.error(`Invalid argument: ${arg}. Please provide a valid number.`);
  process.exit(1);
}

const filteredOrders = validOrders.filter((order) => order.total >= minTotal);
console.log(validOrders);
console.log(`Total valid orders: ${validOrders.length}`);
console.log(`Total invalid orders: ${invalidCount}`);
console.log(`Orders with total >= ${minTotal}: ${filteredOrders.length}`);

console.table(
  filteredOrders.toSorted((a, b) => b.total - a.total),
  ["id", "customer", "total", "status", "created_at"],
);

await writeFile("report.json", JSON.stringify(filteredOrders, null, 2), "utf8");
