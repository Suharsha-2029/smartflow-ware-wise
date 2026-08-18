import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  PackageCheck,
  Play,
  ShieldAlert,
  TrendingDown,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecisionFeed } from "@/components/wh/DecisionFeed";
import { PriorityPill, SectionHead, SlaBar, StageTag, StatCard, Tag } from "@/components/wh/atoms";
import { availableOf, STAGE_FLOW, STAGE_LABEL } from "@/lib/warehouse/engine";
import { useDerived, useWarehouse } from "@/lib/warehouse/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlowDock — Smart Warehouse Control Tower" },
      {
        name: "description",
        content:
          "Live warehouse control tower: SLA-ranked orders, automated stock allocation with pre-emption, exception resolution and dispatch tracking.",
      },
      { property: "og:title", content: "FlowDock — Smart Warehouse Control Tower" },
      {
        property: "og:description",
        content: "Decision-first warehouse operations: prioritise, allocate, pick, pack and dispatch without bottlenecks.",
      },
    ],
  }),
  component: ControlTower,
});

function ControlTower() {
  const { products, orders, allocate } = useWarehouse();
  const { ranked, recs, wave } = useDerived();

  const open = orders.filter((o) => o.stage !== "dispatched");
  const breached = open.filter((o) => o.placedHoursAgo >= o.slaHours).length;
  const atRisk = open.filter((o) => o.placedHoursAgo / o.slaHours >= 0.7 && o.placedHoursAgo < o.slaHours).length;
  const unfilled = open.reduce((s, o) => s + o.lines.reduce((a, l) => a + Math.max(0, l.qty - l.allocated), 0), 0);
  const stockouts = products.filter((p) => availableOf(p) === 0).length;
  const holds = orders.filter((o) => o.stage === "on_hold");
  const dispatched = orders.filter((o) => o.stage === "dispatched").length;

  const topThree = ranked.filter((r) => r.order.stage !== "dispatched").slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="panel grid-lines mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <Tag tone="primary">Shift A · Live</Tag>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Warehouse control tower</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Every open order is scored on SLA pressure, customer tier, channel and value. The allocation engine reserves
            stock against that ranking — and pre-empts lower-priority reservations when a critical order would otherwise
            miss its cut-off.
          </p>
        </div>
        <Button size="lg" onClick={allocate}>
          <Play className="size-4" /> Run allocation engine
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Open orders" value={open.length} hint={`${dispatched} dispatched today`} icon={<PackageCheck className="size-4" />} />
        <StatCard label="SLA breached" value={breached} tone={breached ? "danger" : "success"} hint={`${atRisk} at risk (<30% left)`} icon={<Clock className="size-4" />} />
        <StatCard label="Unfilled units" value={unfilled} tone={unfilled ? "warning" : "success"} hint="Demand awaiting stock" icon={<TrendingDown className="size-4" />} />
        <StatCard label="Stockouts" value={stockouts} tone={stockouts ? "danger" : "success"} hint={`${recs.length} SKUs need reorder`} icon={<ShieldAlert className="size-4" />} />
        <StatCard label="Exceptions on hold" value={holds.length} tone={holds.length ? "warning" : "success"} hint="Awaiting resolution" icon={<AlertTriangle className="size-4" />} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHead
            title="Priority queue"
            subtitle="What the floor should work on next, and why"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/orders">
                  All orders <ArrowRight className="size-4" />
                </Link>
              </Button>
            }
          />
          <div className="space-y-3">
            {topThree.map(({ order, prio }) => (
              <div key={order.id} className="panel p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{order.id}</span>
                  <span className="text-sm text-muted-foreground">{order.customer}</span>
                  <PriorityPill prio={prio} />
                  <StageTag stage={order.stage} />
                  <span className="ml-auto text-xs text-muted-foreground">
                    {prio.hoursToSla <= 0 ? `${Math.abs(prio.hoursToSla)}h overdue` : `${prio.hoursToSla}h to SLA`}
                  </span>
                </div>
                <div className="mt-3">
                  <SlaBar order={order} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Why: </span>
                  {prio.reasons.join(" · ")}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <SectionHead title="Flow board" subtitle="Where work is sitting right now" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {STAGE_FLOW.map((stage) => {
                const count = orders.filter((o) => o.stage === stage).length;
                return (
                  <div key={stage} className="panel p-3 text-center">
                    <p className="font-display text-2xl font-bold tabular-nums">{count}</p>
                    <p className="mt-1 text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                      {STAGE_LABEL[stage]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8">
            <SectionHead
              title="Recommended pick wave"
              subtitle={`${wave.stops} pick stops sequenced across ${wave.route.length} zones · est. ${wave.savedMinutes} min saved vs order-by-order`}
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/fulfillment">
                    Open floor <ArrowRight className="size-4" />
                  </Link>
                </Button>
              }
            />
            <div className="panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                {wave.route.length ? (
                  wave.route.map((r, i) => (
                    <span key={r.zone} className="flex items-center gap-2">
                      <Tag tone="flow">
                        Zone {r.zone} · {r.units}u
                      </Tag>
                      {i < wave.route.length - 1 ? <ArrowRight className="size-3 text-muted-foreground" /> : null}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No allocated orders waiting — run the allocation engine.</p>
                )}
              </div>
              {wave.orders.length ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {wave.orders.map(({ order, prio }) => (
                    <li key={order.id} className="flex items-center gap-2">
                      <Truck className="size-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{order.id}</span>
                      <span className="text-muted-foreground">{order.customer}</span>
                      <span className="ml-auto text-xs text-muted-foreground">score {prio.score}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <DecisionFeed />
          <div className="panel p-4">
            <h3 className="font-display text-sm font-semibold uppercase tracking-widest">Replenishment alerts</h3>
            <ul className="mt-3 space-y-3">
              {recs.slice(0, 5).map((r) => (
                <li key={r.sku} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Tag tone={r.urgency === "stockout" ? "danger" : r.urgency === "critical" ? "warning" : "muted"}>
                      {r.urgency}
                    </Tag>
                    <span className="font-mono text-xs">{r.sku}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{r.daysOfCover}d cover</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.name} — order {r.suggestedQty} units.
                  </p>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" className="mt-4 w-full" asChild>
              <Link to="/inventory">Open inventory</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
