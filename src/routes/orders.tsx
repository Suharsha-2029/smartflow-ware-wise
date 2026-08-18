import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriorityPill, SectionHead, SlaBar, StageTag, Tag } from "@/components/wh/atoms";
import { availableOf, STAGE_LABEL } from "@/lib/warehouse/engine";
import { useDerived, useWarehouse } from "@/lib/warehouse/store";
import type { OrderStage } from "@/lib/warehouse/types";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Order Queue & Prioritisation — FlowDock" },
      {
        name: "description",
        content:
          "SLA-scored order queue with transparent priority reasoning, line-level allocation coverage and one-click stage progression.",
      },
      { property: "og:title", content: "Order Queue & Prioritisation — FlowDock" },
      { property: "og:description", content: "See exactly why each warehouse order ranks where it does." },
    ],
  }),
  component: OrdersPage,
});

const FILTERS: Array<{ key: OrderStage | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "intake", label: "Intake" },
  { key: "allocated", label: "Allocated" },
  { key: "picking", label: "Picking" },
  { key: "packing", label: "Packing" },
  { key: "qc", label: "QC" },
  { key: "on_hold", label: "On hold" },
  { key: "dispatched", label: "Dispatched" },
];

function OrdersPage() {
  const { products, allocate, advance, hold, release } = useWarehouse();
  const { ranked } = useDerived();
  const [filter, setFilter] = useState<OrderStage | "all">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = ranked.filter(
    ({ order }) =>
      (filter === "all" || order.stage === filter) &&
      (q.trim() === "" ||
        order.id.toLowerCase().includes(q.toLowerCase()) ||
        order.customer.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SectionHead
        title="Order queue"
        subtitle="Ranked by the priority engine — highest operational risk first"
        action={
          <Button onClick={allocate}>
            <Play className="size-4" /> Run allocation
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order or customer"
            className="w-56 pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "secondary"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map(({ order, prio }) => {
          const totalQty = order.lines.reduce((s, l) => s + l.qty, 0);
          const alloc = order.lines.reduce((s, l) => s + l.allocated, 0);
          const coverage = Math.round((alloc / totalQty) * 100);
          const isOpen = openId === order.id;
          return (
            <div key={order.id} className="panel overflow-hidden">
              <button
                className="flex w-full flex-wrap items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
                onClick={() => setOpenId(isOpen ? null : order.id)}
              >
                <ChevronRight className={`size-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                <span className="font-mono text-sm font-semibold">{order.id}</span>
                <span className="text-sm text-muted-foreground">{order.customer}</span>
                <Tag tone={order.tier === "platinum" ? "primary" : order.tier === "gold" ? "warning" : "muted"}>
                  {order.tier}
                </Tag>
                <Tag>{order.channel}</Tag>
                <PriorityPill prio={prio} />
                <StageTag stage={order.stage} />
                <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span className={coverage === 100 ? "text-success" : coverage > 0 ? "text-warning" : "text-destructive"}>
                    {coverage}% allocated
                  </span>
                  <span>{prio.hoursToSla <= 0 ? `${Math.abs(prio.hoursToSla)}h overdue` : `${prio.hoursToSla}h left`}</span>
                </span>
                <div className="w-full">
                  <SlaBar order={order} />
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-border bg-surface-2/40 p-4">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Priority reasoning
                      </h4>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {prio.reasons.map((r) => (
                          <li key={r}>• {r}</li>
                        ))}
                      </ul>
                      {order.holdReason ? (
                        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                          Hold: {order.holdReason}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Lines</h4>
                      <table className="mt-2 w-full text-sm">
                        <tbody>
                          {order.lines.map((l) => {
                            const prod = products.find((p) => p.sku === l.sku);
                            const short = l.qty - l.allocated;
                            return (
                              <tr key={l.sku} className="border-b border-border/60 last:border-0">
                                <td className="py-1.5 font-mono text-xs">{l.sku}</td>
                                <td className="py-1.5 text-muted-foreground">{prod?.name}</td>
                                <td className="py-1.5 text-right tabular-nums">
                                  {l.allocated}/{l.qty}
                                </td>
                                <td className="py-1.5 pl-3 text-right">
                                  {short > 0 ? (
                                    <Tag tone="danger">short {short}</Tag>
                                  ) : (
                                    <Tag tone="success">covered</Tag>
                                  )}
                                </td>
                                <td className="py-1.5 pl-3 text-right text-xs text-muted-foreground">
                                  {prod ? `${availableOf(prod)} free · ${prod.bin}` : ""}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.stage !== "dispatched" && order.stage !== "on_hold" ? (
                      <Button size="sm" onClick={() => advance(order.id)}>
                        Advance to next stage <ChevronRight className="size-4" />
                      </Button>
                    ) : null}
                    {order.stage === "on_hold" ? (
                      <Button size="sm" onClick={() => release(order.id)}>
                        Release hold
                      </Button>
                    ) : order.stage !== "dispatched" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => hold(order.id, "Manually held by supervisor for review")}
                      >
                        Put on hold
                      </Button>
                    ) : null}
                    <span className="self-center text-xs text-muted-foreground">
                      Current stage: {STAGE_LABEL[order.stage]}
                      {order.assignee ? ` · ${order.assignee}` : ""}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No orders match this view.</p> : null}
      </div>
    </div>
  );
}
