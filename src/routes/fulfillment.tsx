import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, ClipboardCheck, PackageCheck, Truck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriorityPill, SectionHead, StageTag, Tag } from "@/components/wh/atoms";
import { DecisionFeed } from "@/components/wh/DecisionFeed";
import { STAGE_LABEL } from "@/lib/warehouse/engine";
import { useDerived, useWarehouse } from "@/lib/warehouse/store";
import type { OrderStage } from "@/lib/warehouse/types";

export const Route = createFileRoute("/fulfillment")({
  head: () => ({
    meta: [
      { title: "Picking, Packing & Dispatch — FlowDock" },
      {
        name: "description",
        content:
          "Warehouse floor board for picking, packing, quality checks and dispatch, with damaged or missing item exception handling and automatic resolution.",
      },
      { property: "og:title", content: "Picking, Packing & Dispatch — FlowDock" },
      { property: "og:description", content: "Move work across the floor and resolve exceptions in one place." },
    ],
  }),
  component: FulfillmentPage,
});

const COLUMNS: OrderStage[] = ["allocated", "picking", "packing", "qc", "dispatched"];

function FulfillmentPage() {
  const { orders, products, advance, reportException, release } = useWarehouse();
  const { ranked, wave } = useDerived();
  const [exc, setExc] = useState<{ orderId: string; sku: string } | null>(null);
  const [qty, setQty] = useState("1");
  const [type, setType] = useState<"damaged" | "missing">("damaged");

  const holds = orders.filter((o) => o.stage === "on_hold");
  const scoreOf = (id: string) => ranked.find((r) => r.order.id === id)!;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SectionHead
        title="Floor operations"
        subtitle={`Wave suggestion: ${wave.route.map((r) => `Zone ${r.zone}`).join(" → ") || "no wave"} · ${wave.stops} stops`}
      />

      <div className="grid gap-3 lg:grid-cols-5">
        {COLUMNS.map((stage) => {
          const col = ranked.filter((r) => r.order.stage === stage);
          return (
            <div key={stage} className="panel flex flex-col gap-2 p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xs font-semibold uppercase tracking-widest">{STAGE_LABEL[stage]}</h3>
                <span className="text-xs tabular-nums text-muted-foreground">{col.length}</span>
              </div>
              {col.map(({ order, prio }) => (
                <div key={order.id} className="rounded-md border border-border bg-surface-2 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{order.id}</span>
                    <PriorityPill prio={prio} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{order.customer}</p>
                  {order.assignee ? (
                    <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                      <User className="size-3" /> {order.assignee}
                    </p>
                  ) : null}
                  <ul className="mt-2 space-y-1">
                    {order.lines.map((l) => {
                      const prod = products.find((p) => p.sku === l.sku);
                      return (
                        <li key={l.sku} className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
                          <span className="font-mono">{prod?.bin ?? l.sku}</span>
                          <span className="tabular-nums">
                            {l.allocated}/{l.qty}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {stage !== "dispatched" ? (
                    <div className="mt-3 flex gap-1">
                      <Button size="sm" className="flex-1" onClick={() => advance(order.id)}>
                        {stage === "qc" ? <Truck className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                        {stage === "allocated" ? "Pick" : stage === "picking" ? "Pack" : stage === "packing" ? "QC" : "Dispatch"}
                      </Button>
                      {stage === "picking" || stage === "qc" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label="Report exception"
                          onClick={() => {
                            setExc({ orderId: order.id, sku: order.lines[0]!.sku });
                            setQty("1");
                          }}
                        >
                          <AlertTriangle className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <Tag tone="success" className="mt-3">
                      <PackageCheck className="size-3" /> shipped
                    </Tag>
                  )}
                </div>
              ))}
              {col.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">Empty</p> : null}
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHead title="Exception desk" subtitle="Orders blocked by damaged, missing or short stock" />
          <div className="space-y-3">
            {holds.map((o) => (
              <div key={o.id} className="panel border-destructive/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{o.id}</span>
                  <span className="text-sm text-muted-foreground">{o.customer}</span>
                  <StageTag stage={o.stage} />
                  <PriorityPill prio={scoreOf(o.id).prio} />
                </div>
                <p className="mt-2 text-xs text-destructive">{o.holdReason}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => release(o.id)}>
                    <ClipboardCheck className="size-4" /> Resolve & re-queue
                  </Button>
                </div>
              </div>
            ))}
            {holds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No blocked orders. Report a damaged or missing item from a picking card to see the resolution engine work.
              </p>
            ) : null}
          </div>
        </div>
        <DecisionFeed limit={8} />
      </div>

      <Dialog open={exc !== null} onOpenChange={(v) => !v && setExc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report pick exception</DialogTitle>
            <DialogDescription>
              FlowDock will try to cover the loss from free stock. If nothing is available the order is held, the line is
              de-allocated and replenishment is recommended.
            </DialogDescription>
          </DialogHeader>
          {exc ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">SKU</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                  value={exc.sku}
                  onChange={(e) => setExc({ ...exc, sku: e.target.value })}
                >
                  {orders
                    .find((o) => o.id === exc.orderId)!
                    .lines.map((l) => (
                      <option key={l.sku} value={l.sku}>
                        {l.sku} — allocated {l.allocated}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Quantity</Label>
                  <Input className="mt-1" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Type</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={type}
                    onChange={(e) => setType(e.target.value as "damaged" | "missing")}
                  >
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing / not in bin</option>
                  </select>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => {
                if (!exc) return;
                reportException(exc.orderId, exc.sku, Math.max(1, Number(qty) || 1), type);
                setExc(null);
              }}
            >
              Submit exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
