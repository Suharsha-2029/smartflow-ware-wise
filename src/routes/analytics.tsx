import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHead, StatCard, Tag } from "@/components/wh/atoms";
import { availableOf, orderValue, STAGE_FLOW, STAGE_LABEL } from "@/lib/warehouse/engine";
import { useDerived, useWarehouse } from "@/lib/warehouse/store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Operational Analytics & Bottlenecks — FlowDock" },
      {
        name: "description",
        content:
          "Stage-level WIP, SLA risk, fill-rate and throughput analytics that pinpoint the bottleneck holding up warehouse fulfillment.",
      },
      { property: "og:title", content: "Operational Analytics & Bottlenecks — FlowDock" },
      { property: "og:description", content: "Find the constraint before it becomes a missed shipment." },
    ],
  }),
  component: AnalyticsPage,
});

const CAPACITY: Record<string, number> = { intake: 12, allocated: 10, picking: 6, packing: 5, qc: 4, dispatched: 99 };

function AnalyticsPage() {
  const { orders, products } = useWarehouse();
  const { recs } = useDerived();

  const stageData = STAGE_FLOW.map((s) => {
    const wip = orders.filter((o) => o.stage === s).length;
    return { stage: STAGE_LABEL[s], wip, capacity: CAPACITY[s] ?? 8, load: Math.round((wip / (CAPACITY[s] ?? 8)) * 100) };
  });

  const bottleneck = stageData
    .filter((s) => s.stage !== "Dispatched")
    .sort((a, b) => b.load - a.load)[0]!;

  const open = orders.filter((o) => o.stage !== "dispatched");
  const demanded = open.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty, 0), 0);
  const allocated = open.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.allocated, 0), 0);
  const fillRate = demanded ? Math.round((allocated / demanded) * 100) : 100;
  const atRisk = open.filter((o) => o.placedHoursAgo / o.slaHours >= 0.7).length;
  const backlogValue = Math.round(open.reduce((s, o) => s + orderValue(o, products), 0));

  const slaCurve = [2, 4, 6, 8, 12, 16, 24, 36, 48].map((h) => ({
    window: `${h}h`,
    due: open.filter((o) => o.slaHours - o.placedHoursAgo <= h).length,
  }));

  const zoneLoad = ["A", "B", "C", "D"].map((z) => ({
    zone: `Zone ${z}`,
    units: open.reduce(
      (s, o) =>
        s +
        o.lines.reduce((a, l) => {
          const p = products.find((pp) => pp.sku === l.sku);
          return a + (p && p.zone === z ? l.qty - l.picked : 0);
        }, 0),
      0,
    ),
  }));

  const riskSkus = products
    .map((p) => ({ p, cover: p.dailyDemand ? availableOf(p) / p.dailyDemand : 99 }))
    .sort((a, b) => a.cover - b.cover)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SectionHead title="Operational analytics" subtitle="Where the flow is constrained and what it is costing" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Fill rate" value={`${fillRate}%`} tone={fillRate > 90 ? "success" : "warning"} hint={`${allocated}/${demanded} units allocated`} />
        <StatCard label="SLA at risk" value={atRisk} tone={atRisk ? "danger" : "success"} hint="≥70% of window elapsed" />
        <StatCard label="Backlog value" value={`$${backlogValue.toLocaleString()}`} hint="Undispatched order value" />
        <StatCard label="Reorder signals" value={recs.length} tone={recs.length ? "warning" : "success"} hint="SKUs needing purchase" />
      </div>

      <div className="panel mt-6 border-warning/40 p-5">
        <Tag tone="warning">Bottleneck detected</Tag>
        <h3 className="mt-2 font-display text-xl font-semibold">
          {bottleneck.stage} is at {bottleneck.load}% of capacity
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {bottleneck.wip} orders queued against {bottleneck.capacity} slots. Recommendation:{" "}
          {bottleneck.stage === "Picking"
            ? "release a zone-batched wave and move one packer to picking for 45 minutes."
            : bottleneck.stage === "Allocated"
              ? "run the allocation engine and dispatch the top-scoring wave before intake grows."
              : bottleneck.stage === "Quality check"
                ? "add a second QC bench — sampling instead of 100% checks on standard-tier orders."
                : "rebalance staff toward this stage before the next intake batch lands."}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel p-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest">WIP vs capacity by stage</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="wip" radius={[4, 4, 0, 0]}>
                  {stageData.map((d) => (
                    <Cell key={d.stage} fill={d.load >= 100 ? "var(--color-destructive)" : d.load >= 70 ? "var(--color-warning)" : "var(--color-flow)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest">Orders due within window</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={slaCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="window" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="due" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest">Pick workload by zone</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneLoad} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis dataKey="zone" type="category" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="units" fill="var(--color-flow)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest">Lowest days of cover</h3>
          <ul className="mt-4 space-y-3">
            {riskSkus.map(({ p, cover }) => (
              <li key={p.sku} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs">{p.sku}</span>
                <span className="truncate text-muted-foreground">{p.name}</span>
                <span className="ml-auto tabular-nums">{Math.round(cover * 10) / 10}d</span>
                <Tag tone={cover < 1 ? "danger" : cover < 4 ? "warning" : "success"}>
                  {cover < 1 ? "act now" : cover < 4 ? "order soon" : "ok"}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
