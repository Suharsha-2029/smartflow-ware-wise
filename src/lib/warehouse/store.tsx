import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CUSTOMER_POOL, PICKERS, SEED_ORDERS, SEED_PRODUCTS } from "./data";
import {
  availableOf,
  buildPickWave,
  priorityOf,
  reorderRecommendations,
  runAllocation,
  STAGE_FLOW,
  STAGE_LABEL,
} from "./engine";
import type { DecisionLog, Product, WarehouseOrder } from "./types";

let logSeq = 0;
const mkLog = (
  kind: DecisionLog["kind"],
  title: string,
  detail: string,
  severity: DecisionLog["severity"] = "info",
): DecisionLog => ({
  id: `log-${++logSeq}`,
  at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  kind,
  title,
  detail,
  severity,
});

interface Ctx {
  products: Product[];
  orders: WarehouseOrder[];
  logs: DecisionLog[];
  allocate: () => void;
  advance: (orderId: string) => void;
  hold: (orderId: string, reason: string) => void;
  release: (orderId: string) => void;
  reportException: (orderId: string, sku: string, qty: number, type: "damaged" | "missing") => void;
  raisePO: (sku: string, qty: number) => void;
  receivePO: (sku: string) => void;
  injectOrder: () => void;
  resetSim: () => void;
}

const WarehouseCtx = createContext<Ctx | null>(null);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [orders, setOrders] = useState<WarehouseOrder[]>(SEED_ORDERS);
  const [logs, setLogs] = useState<DecisionLog[]>([
    mkLog("flow", "Shift started", "Seed inventory and 10 open orders loaded into the control tower.", "info"),
  ]);

  const pushLogs = useCallback((entries: DecisionLog[]) => {
    if (entries.length) setLogs((prev) => [...entries, ...prev].slice(0, 120));
  }, []);

  const allocate = useCallback(() => {
    setProducts((prevP) => {
      setOrders((prevO) => {
        const res = runAllocation(prevP, prevO);
        setProducts(res.products);
        pushLogs(res.logs.map((l) => mkLog(l.kind, l.title, l.detail, l.severity)));
        const shorts = res.logs.filter((l) => l.severity !== "info").length;
        toast.success("Allocation run complete", {
          description: shorts ? `${shorts} exception decision(s) logged` : "All open demand covered",
        });
        return res.orders;
      });
      return prevP;
    });
  }, [pushLogs]);

  const advance = useCallback(
    (orderId: string) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const idx = STAGE_FLOW.indexOf(o.stage);
          if (idx < 0 || idx === STAGE_FLOW.length - 1) return o;
          const next = STAGE_FLOW[idx + 1];
          if (next === "picking" && !o.lines.some((l) => l.allocated > 0)) {
            toast.error(`${o.id} has no allocated stock`, { description: "Run allocation or raise a PO first." });
            return o;
          }
          const assignee = next === "picking" ? PICKERS[Math.floor(Math.random() * PICKERS.length)] : o.assignee;
          const lines = next === "packing" ? o.lines.map((l) => ({ ...l, picked: l.allocated })) : o.lines;

          if (next === "dispatched") {
            setProducts((ps) =>
              ps.map((p) => {
                const qty = o.lines.filter((l) => l.sku === p.sku).reduce((a, l) => a + l.allocated, 0);
                return qty ? { ...p, onHand: p.onHand - qty, reserved: Math.max(0, p.reserved - qty) } : p;
              }),
            );
          }
          pushLogs([
            mkLog(
              "flow",
              `${o.id} → ${STAGE_LABEL[next]}`,
              next === "dispatched"
                ? "Dispatched. On-hand inventory decremented and reservations released."
                : next === "picking"
                  ? `Assigned to ${assignee}. Zone-sequenced pick list issued.`
                  : `Stage advanced by supervisor.`,
              "info",
            ),
          ]);
          return { ...o, stage: next, assignee, lines, stageEnteredAt: Date.now() };
        }),
      );
    },
    [pushLogs],
  );

  const hold = useCallback(
    (orderId: string, reason: string) => {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, stage: "on_hold", holdReason: reason } : o)));
      pushLogs([mkLog("exception", `${orderId} placed on hold`, reason, "warn")]);
    },
    [pushLogs],
  );

  const release = useCallback(
    (orderId: string) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, stage: "allocated", holdReason: undefined } : o)),
      );
      pushLogs([mkLog("flow", `${orderId} released from hold`, "Returned to the allocated queue.", "info")]);
    },
    [pushLogs],
  );

  const reportException = useCallback(
    (orderId: string, sku: string, qty: number, type: "damaged" | "missing") => {
      let recovered = false;
      setProducts((ps) =>
        ps.map((p) => {
          if (p.sku !== sku) return p;
          const spare = availableOf(p);
          recovered = spare >= qty;
          return type === "damaged"
            ? { ...p, damaged: p.damaged + qty, onHand: Math.max(0, p.onHand - qty) }
            : { ...p, onHand: Math.max(0, p.onHand - qty) };
        }),
      );
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                lines: o.lines.map((l) =>
                  l.sku === sku ? { ...l, allocated: Math.max(0, l.allocated - (recovered ? 0 : qty)) } : l,
                ),
                stage: recovered ? o.stage : "on_hold",
                holdReason: recovered ? undefined : `${qty} × ${sku} ${type} at pick face — awaiting replenishment`,
              }
            : o,
        ),
      );
      pushLogs([
        mkLog(
          "exception",
          `${qty} × ${sku} reported ${type} on ${orderId}`,
          recovered
            ? `Resolution: substituted from free stock in the same SKU pool, order stays in flow. Damaged units quarantined and cycle count scheduled.`
            : `Resolution: no free stock to cover. ${orderId} moved to hold, line de-allocated and an expedited PO is recommended.`,
          recovered ? "warn" : "critical",
        ),
      ]);
      toast[recovered ? "warning" : "error"](
        recovered ? "Exception auto-resolved from free stock" : `${orderId} put on hold`,
      );
    },
    [pushLogs],
  );

  const raisePO = useCallback(
    (sku: string, qty: number) => {
      setProducts((ps) =>
        ps.map((p) => (p.sku === sku ? { ...p, inboundQty: p.inboundQty + qty, inboundEtaDays: p.leadTimeDays } : p)),
      );
      pushLogs([
        mkLog("reorder", `PO raised: ${qty} × ${sku}`, `Purchase order created; ETA follows supplier lead time.`, "info"),
      ]);
      toast.success(`PO raised for ${qty} × ${sku}`);
    },
    [pushLogs],
  );

  const receivePO = useCallback(
    (sku: string) => {
      setProducts((ps) =>
        ps.map((p) =>
          p.sku === sku && p.inboundQty > 0
            ? { ...p, onHand: p.onHand + p.inboundQty, inboundQty: 0, inboundEtaDays: null }
            : p,
        ),
      );
      pushLogs([mkLog("reorder", `Inbound received for ${sku}`, "Goods receipted and put away; stock now allocatable.", "info")]);
      toast.success(`Inbound receipted for ${sku}`);
    },
    [pushLogs],
  );

  const injectOrder = useCallback(() => {
    const [customer, tier, channel] = CUSTOMER_POOL[Math.floor(Math.random() * CUSTOMER_POOL.length)];
    const picks = SEED_PRODUCTS.slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, 1 + Math.floor(Math.random() * 2));
    const id = `ORD-${4830 + Math.floor(Math.random() * 900)}`;
    const order: WarehouseOrder = {
      id,
      customer,
      tier,
      channel,
      placedHoursAgo: 0,
      slaHours: channel === "Express" ? 6 : 24,
      lines: picks.map((p) => ({ sku: p.sku, qty: 5 + Math.floor(Math.random() * 40), allocated: 0, picked: 0 })),
      stage: "intake",
      assignee: null,
      stageEnteredAt: Date.now(),
    };
    setOrders((prev) => [order, ...prev]);
    pushLogs([
      mkLog("priority", `New order ${id} from ${customer}`, `${channel} order, ${order.slaHours}h SLA. Scored and queued for allocation.`, "info"),
    ]);
    toast.info(`Order ${id} received`);
  }, [pushLogs]);

  const resetSim = useCallback(() => {
    setProducts(SEED_PRODUCTS);
    setOrders(SEED_ORDERS);
    setLogs([mkLog("flow", "Simulation reset", "Warehouse restored to the start-of-shift snapshot.", "info")]);
    toast.info("Simulation reset");
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      products,
      orders,
      logs,
      allocate,
      advance,
      hold,
      release,
      reportException,
      raisePO,
      receivePO,
      injectOrder,
      resetSim,
    }),
    [products, orders, logs, allocate, advance, hold, release, reportException, raisePO, receivePO, injectOrder, resetSim],
  );

  return <WarehouseCtx.Provider value={value}>{children}</WarehouseCtx.Provider>;
}

export function useWarehouse() {
  const ctx = useContext(WarehouseCtx);
  if (!ctx) throw new Error("useWarehouse must be used inside WarehouseProvider");
  return ctx;
}

export function useDerived() {
  const { products, orders } = useWarehouse();
  return useMemo(() => {
    const ranked = orders
      .map((o) => ({ order: o, prio: priorityOf(o, products) }))
      .sort((a, b) => b.prio.score - a.prio.score);
    return {
      ranked,
      recs: reorderRecommendations(products, orders),
      wave: buildPickWave(orders, products),
    };
  }, [products, orders]);
}
