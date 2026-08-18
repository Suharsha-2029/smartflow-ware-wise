export type Zone = "A" | "B" | "C" | "D";

export interface Product {
  sku: string;
  name: string;
  category: string;
  zone: Zone;
  bin: string;
  onHand: number;
  reserved: number;
  damaged: number;
  reorderPoint: number;
  reorderQty: number;
  unitCost: number;
  leadTimeDays: number;
  dailyDemand: number;
  inboundQty: number;
  inboundEtaDays: number | null;
}

export type CustomerTier = "platinum" | "gold" | "standard";

export type OrderStage =
  | "intake"
  | "allocated"
  | "picking"
  | "packing"
  | "qc"
  | "dispatched"
  | "on_hold";

export interface OrderLine {
  sku: string;
  qty: number;
  allocated: number;
  picked: number;
}

export interface WarehouseOrder {
  id: string;
  customer: string;
  tier: CustomerTier;
  channel: "B2B" | "Retail" | "Marketplace" | "Express";
  placedHoursAgo: number;
  slaHours: number;
  lines: OrderLine[];
  stage: OrderStage;
  assignee: string | null;
  holdReason?: string;
  stageEnteredAt: number;
}

export interface DecisionLog {
  id: string;
  at: string;
  kind: "allocation" | "reallocation" | "exception" | "reorder" | "priority" | "flow";
  title: string;
  detail: string;
  severity: "info" | "warn" | "critical";
}

export interface PriorityResult {
  score: number;
  band: "critical" | "high" | "normal";
  reasons: string[];
  hoursToSla: number;
}
