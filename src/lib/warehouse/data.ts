import type { Product, WarehouseOrder } from "./types";

export const PICKERS = ["A. Rivera", "M. Osei", "K. Tanaka", "S. Bhatt", "L. Novak"];

const p = (
  sku: string,
  name: string,
  category: string,
  zone: Product["zone"],
  bin: string,
  onHand: number,
  reorderPoint: number,
  reorderQty: number,
  unitCost: number,
  leadTimeDays: number,
  dailyDemand: number,
  damaged = 0,
  inboundQty = 0,
  inboundEtaDays: number | null = null,
): Product => ({
  sku,
  name,
  category,
  zone,
  bin,
  onHand,
  reserved: 0,
  damaged,
  reorderPoint,
  reorderQty,
  unitCost,
  leadTimeDays,
  dailyDemand,
  inboundQty,
  inboundEtaDays,
});

export const SEED_PRODUCTS: Product[] = [
  p("SKU-1001", "Thermal Label Roll 4x6", "Consumables", "A", "A-01-3", 42, 60, 200, 6.5, 4, 18, 0, 200, 2),
  p("SKU-1002", "Cordless Scanner X2", "Devices", "B", "B-04-1", 7, 10, 40, 189, 12, 2.2, 1),
  p("SKU-1003", "Stretch Wrap 500mm", "Packaging", "A", "A-02-7", 310, 120, 300, 9.2, 5, 26),
  p("SKU-1004", "Pallet Jack 2.5T", "Equipment", "D", "D-01-1", 3, 4, 10, 640, 21, 0.4),
  p("SKU-1005", "Corrugated Box M", "Packaging", "A", "A-03-2", 880, 400, 1000, 1.1, 3, 140),
  p("SKU-1006", "Corrugated Box L", "Packaging", "A", "A-03-5", 96, 250, 800, 1.6, 3, 92),
  p("SKU-1007", "Safety Gloves Pair", "PPE", "C", "C-02-4", 220, 150, 400, 3.4, 7, 34, 6),
  p("SKU-1008", "Hi-Vis Vest", "PPE", "C", "C-02-9", 58, 80, 250, 7.8, 7, 12),
  p("SKU-1009", "Shelf Bracket Steel", "Hardware", "D", "D-03-6", 0, 40, 150, 12.4, 15, 8, 0, 150, 6),
  p("SKU-1010", "Void Fill Paper", "Packaging", "B", "B-01-2", 140, 100, 300, 4.2, 4, 30),
  p("SKU-1011", "Barcode Printer P70", "Devices", "B", "B-05-3", 11, 6, 15, 420, 18, 0.9),
  p("SKU-1012", "Cold Chain Gel Pack", "Consumables", "C", "C-05-1", 64, 90, 400, 2.1, 6, 40, 4),
];

const o = (
  id: string,
  customer: string,
  tier: WarehouseOrder["tier"],
  channel: WarehouseOrder["channel"],
  placedHoursAgo: number,
  slaHours: number,
  lines: [string, number][],
): WarehouseOrder => ({
  id,
  customer,
  tier,
  channel,
  placedHoursAgo,
  slaHours,
  lines: lines.map(([sku, qty]) => ({ sku, qty, allocated: 0, picked: 0 })),
  stage: "intake",
  assignee: null,
  stageEnteredAt: Date.now(),
});

export const SEED_ORDERS: WarehouseOrder[] = [
  o("ORD-4821", "Northwind Retail", "platinum", "Express", 5, 6, [["SKU-1002", 10], ["SKU-1001", 20]]),
  o("ORD-4822", "Kite Logistics", "standard", "B2B", 2, 24, [["SKU-1002", 5], ["SKU-1005", 60]]),
  o("ORD-4823", "Bayside Grocers", "gold", "Retail", 9, 12, [["SKU-1012", 80], ["SKU-1003", 12]]),
  o("ORD-4824", "Halcyon Labs", "platinum", "B2B", 1, 48, [["SKU-1009", 25], ["SKU-1007", 40]]),
  o("ORD-4825", "Peak Outfitters", "standard", "Marketplace", 14, 16, [["SKU-1006", 120]]),
  o("ORD-4826", "Union Freight", "gold", "B2B", 3, 24, [["SKU-1004", 2], ["SKU-1010", 30]]),
  o("ORD-4827", "Trailhead Co.", "standard", "Marketplace", 20, 24, [["SKU-1008", 30], ["SKU-1007", 25]]),
  o("ORD-4828", "Cobalt Pharma", "platinum", "Express", 4, 5, [["SKU-1012", 60], ["SKU-1001", 15]]),
  o("ORD-4829", "Riverside Depot", "gold", "Retail", 7, 36, [["SKU-1005", 200], ["SKU-1003", 40]]),
  o("ORD-4830", "Vantage Supply", "standard", "B2B", 11, 48, [["SKU-1011", 4], ["SKU-1001", 10]]),
];

export const CUSTOMER_POOL: Array<[string, WarehouseOrder["tier"], WarehouseOrder["channel"]]> = [
  ["Northwind Retail", "platinum", "Express"],
  ["Kite Logistics", "standard", "B2B"],
  ["Bayside Grocers", "gold", "Retail"],
  ["Summit Traders", "gold", "Marketplace"],
  ["Cobalt Pharma", "platinum", "Express"],
  ["Vantage Supply", "standard", "B2B"],
];
