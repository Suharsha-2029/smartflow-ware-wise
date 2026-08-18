import type { Product, PriorityResult, WarehouseOrder } from "./types";

const TIER_WEIGHT: Record<WarehouseOrder["tier"], number> = {
  platinum: 30,
  gold: 18,
  standard: 8,
};

const CHANNEL_WEIGHT: Record<WarehouseOrder["channel"], number> = {
  Express: 18,
  Retail: 8,
  B2B: 6,
  Marketplace: 4,
};

export function orderValue(order: WarehouseOrder, products: Product[]): number {
  return order.lines.reduce((sum, l) => {
    const prod = products.find((p) => p.sku === l.sku);
    return sum + (prod ? prod.unitCost * l.qty : 0);
  }, 0);
}

/** Composite priority: SLA urgency dominates, then tier, channel, value and ageing. */
export function priorityOf(order: WarehouseOrder, products: Product[]): PriorityResult {
  const hoursToSla = order.slaHours - order.placedHoursAgo;
  const reasons: string[] = [];

  let urgency: number;
  if (hoursToSla <= 0) {
    urgency = 60;
    reasons.push(`SLA breached by ${Math.abs(hoursToSla)}h`);
  } else {
    urgency = Math.min(55, Math.round(55 / Math.max(1, hoursToSla / 2)));
    reasons.push(`${hoursToSla}h left on ${order.slaHours}h SLA`);
  }

  const tier = TIER_WEIGHT[order.tier];
  reasons.push(`${order.tier} customer (+${tier})`);

  const channel = CHANNEL_WEIGHT[order.channel];
  reasons.push(`${order.channel} channel (+${channel})`);

  const value = orderValue(order, products);
  const valueScore = Math.min(20, Math.round(value / 250));
  if (valueScore > 0) reasons.push(`Order value $${Math.round(value).toLocaleString()} (+${valueScore})`);

  const ageing = Math.min(12, Math.round(order.placedHoursAgo / 3));
  if (ageing > 0) reasons.push(`Waiting ${order.placedHoursAgo}h (+${ageing})`);

  const score = urgency + tier + channel + valueScore + ageing;
  const band: PriorityResult["band"] = score >= 95 ? "critical" : score >= 65 ? "high" : "normal";
  return { score, band, reasons, hoursToSla };
}

export function availableOf(p: Product): number {
  return Math.max(0, p.onHand - p.reserved - p.damaged);
}

export interface AllocationOutcome {
  products: Product[];
  orders: WarehouseOrder[];
  logs: Array<{ kind: "allocation" | "reallocation"; title: string; detail: string; severity: "info" | "warn" | "critical" }>;
}

/**
 * Greedy priority allocation with pre-emption.
 * Orders are ranked by score; a critical order that is short may reclaim stock
 * already reserved by a lower-priority, not-yet-picking order.
 */
export function runAllocation(productsIn: Product[], ordersIn: WarehouseOrder[]): AllocationOutcome {
  const products = productsIn.map((p) => ({ ...p }));
  const orders = ordersIn.map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l })) }));
  const logs: AllocationOutcome["logs"] = [];

  const ranked = orders
    .filter((o) => o.stage === "intake" || o.stage === "allocated")
    .map((o) => ({ o, prio: priorityOf(o, products) }))
    .sort((a, b) => b.prio.score - a.prio.score);

  for (const { o, prio } of ranked) {
    for (const line of o.lines) {
      const prod = products.find((p) => p.sku === line.sku);
      if (!prod) continue;
      let need = line.qty - line.allocated;
      if (need <= 0) continue;

      const take = Math.min(need, availableOf(prod));
      if (take > 0) {
        prod.reserved += take;
        line.allocated += take;
        need -= take;
      }

      // Pre-emption: pull stock back from lower-priority orders not yet picking.
      if (need > 0 && prio.band === "critical") {
        const donors = ranked
          .filter(
            (r) =>
              r.o.id !== o.id &&
              r.prio.score < prio.score - 15 &&
              r.o.stage !== "picking" &&
              r.o.lines.some((l) => l.sku === line.sku && l.allocated > 0),
          )
          .sort((a, b) => a.prio.score - b.prio.score);

        for (const donor of donors) {
          if (need <= 0) break;
          const dLine = donor.o.lines.find((l) => l.sku === line.sku)!;
          const pull = Math.min(need, dLine.allocated);
          dLine.allocated -= pull;
          line.allocated += pull;
          need -= pull;
          logs.push({
            kind: "reallocation",
            title: `Pre-empted ${pull} × ${line.sku} from ${donor.o.id}`,
            detail: `${o.id} (score ${prio.score}, ${prio.hoursToSla}h to SLA) outranks ${donor.o.id} (score ${donor.prio.score}, ${donor.prio.hoursToSla}h to SLA). Stock re-reserved to protect the tighter SLA; ${donor.o.id} moves to partial/backorder.`,
            severity: "warn",
          });
        }
      }

      if (need > 0) {
        logs.push({
          kind: "allocation",
          title: `Short ${need} × ${line.sku} on ${o.id}`,
          detail:
            line.allocated > 0
              ? `Partial allocation ${line.allocated}/${line.qty}. Recommendation: ship short now and raise a backorder — ${prod.name} lead time ${prod.leadTimeDays}d.`
              : `No stock available. Recommendation: hold line, expedite PO for ${prod.reorderQty} units (${prod.leadTimeDays}d lead time).`,
          severity: line.allocated > 0 ? "warn" : "critical",
        });
      }
    }

    const fullyAllocated = o.lines.every((l) => l.allocated >= l.qty);
    const partly = o.lines.some((l) => l.allocated > 0);
    if (o.stage === "intake" && (fullyAllocated || partly)) o.stage = "allocated";
    if (fullyAllocated) {
      logs.push({
        kind: "allocation",
        title: `${o.id} fully allocated`,
        detail: `All ${o.lines.length} line(s) reserved. Priority ${prio.score} (${prio.band}).`,
        severity: "info",
      });
    }
  }

  // Reserved must reflect actual line allocations.
  for (const prod of products) {
    prod.reserved = orders
      .filter((o) => o.stage !== "dispatched")
      .reduce((s, o) => s + o.lines.filter((l) => l.sku === prod.sku).reduce((a, l) => a + l.allocated, 0), 0);
  }

  return { products, orders, logs };
}

export interface ReorderRec {
  sku: string;
  name: string;
  available: number;
  reorderPoint: number;
  daysOfCover: number;
  suggestedQty: number;
  urgency: "stockout" | "critical" | "watch";
  rationale: string;
}

export function reorderRecommendations(products: Product[], orders: WarehouseOrder[]): ReorderRec[] {
  const openDemand = (sku: string) =>
    orders
      .filter((o) => o.stage !== "dispatched")
      .reduce((s, o) => s + o.lines.filter((l) => l.sku === sku).reduce((a, l) => a + (l.qty - l.allocated), 0), 0);

  return products
    .map((p) => {
      const available = availableOf(p);
      const daysOfCover = p.dailyDemand > 0 ? available / p.dailyDemand : 99;
      const shortfall = openDemand(p.sku);
      const demandDuringLead = Math.ceil(p.dailyDemand * p.leadTimeDays);
      const suggestedQty = Math.max(
        p.reorderQty,
        Math.ceil(demandDuringLead + shortfall - available - p.inboundQty),
      );
      const urgency: ReorderRec["urgency"] =
        available === 0 ? "stockout" : available < p.reorderPoint ? "critical" : "watch";
      return {
        sku: p.sku,
        name: p.name,
        available,
        reorderPoint: p.reorderPoint,
        daysOfCover: Math.round(daysOfCover * 10) / 10,
        suggestedQty: Math.max(0, suggestedQty),
        urgency,
        rationale:
          `${available} available vs ${p.reorderPoint} reorder point. ` +
          `Lead-time demand ${demandDuringLead} units over ${p.leadTimeDays}d` +
          (shortfall > 0 ? `, ${shortfall} units of open order demand unfilled` : "") +
          (p.inboundQty > 0 ? `, ${p.inboundQty} inbound in ${p.inboundEtaDays}d` : ", no inbound PO") +
          ".",
      };
    })
    .filter((r) => r.urgency !== "watch" || r.daysOfCover < 6)
    .sort((a, b) => a.daysOfCover - b.daysOfCover);
}

/** Wave-picking route optimisation: group ready orders by zone density. */
export function buildPickWave(orders: WarehouseOrder[], products: Product[]) {
  const ready = orders.filter((o) => o.stage === "allocated" && o.lines.some((l) => l.allocated > 0));
  const ranked = ready
    .map((o) => ({ o, prio: priorityOf(o, products) }))
    .sort((a, b) => b.prio.score - a.prio.score)
    .slice(0, 5);

  const zones = new Map<string, number>();
  for (const { o } of ranked) {
    for (const l of o.lines) {
      const prod = products.find((p) => p.sku === l.sku);
      if (prod && l.allocated > 0) zones.set(prod.zone, (zones.get(prod.zone) ?? 0) + l.allocated);
    }
  }
  const route = [...zones.entries()].sort((a, b) => b[1] - a[1]).map(([z, units]) => ({ zone: z, units }));
  const stops = ranked.reduce((s, { o }) => s + o.lines.filter((l) => l.allocated > 0).length, 0);
  return { orders: ranked, route, stops, savedMinutes: Math.max(0, stops * 2 - route.length * 2) };
}

export const STAGE_FLOW: WarehouseOrder["stage"][] = [
  "intake",
  "allocated",
  "picking",
  "packing",
  "qc",
  "dispatched",
];

export const STAGE_LABEL: Record<WarehouseOrder["stage"], string> = {
  intake: "Intake",
  allocated: "Allocated",
  picking: "Picking",
  packing: "Packing",
  qc: "Quality check",
  dispatched: "Dispatched",
  on_hold: "On hold",
};
