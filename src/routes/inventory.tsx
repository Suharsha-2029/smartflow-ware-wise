import { createFileRoute } from "@tanstack/react-router";
import { PackagePlus, TruckElectric } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHead, StatCard, Tag } from "@/components/wh/atoms";
import { availableOf } from "@/lib/warehouse/engine";
import { useDerived, useWarehouse } from "@/lib/warehouse/store";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory & Replenishment — FlowDock" },
      {
        name: "description",
        content:
          "Live stock positions with reserved, damaged and available splits, days-of-cover forecasting and automated reorder recommendations.",
      },
      { property: "og:title", content: "Inventory & Replenishment — FlowDock" },
      { property: "og:description", content: "Stock visibility with reorder decisions, not just numbers." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { products, raisePO, receivePO } = useWarehouse();
  const { recs } = useDerived();

  const totalValue = products.reduce((s, p) => s + p.onHand * p.unitCost, 0);
  const damaged = products.reduce((s, p) => s + p.damaged, 0);
  const reserved = products.reduce((s, p) => s + p.reserved, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SectionHead title="Inventory" subtitle="On-hand, reserved, damaged and truly available stock by bin" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stock value" value={`$${Math.round(totalValue).toLocaleString()}`} hint={`${products.length} active SKUs`} />
        <StatCard label="Reserved units" value={reserved} hint="Committed to open orders" />
        <StatCard label="Quarantined" value={damaged} tone={damaged ? "warning" : "success"} hint="Damaged / awaiting cycle count" />
        <StatCard label="Reorder signals" value={recs.length} tone={recs.length ? "warning" : "success"} hint="Below point or <6d cover" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHead title="Stock ledger" />
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Location</th>
                  <th className="p-3 text-right">On hand</th>
                  <th className="p-3 text-right">Reserved</th>
                  <th className="p-3 text-right">Damaged</th>
                  <th className="p-3 text-right">Available</th>
                  <th className="p-3 text-right">Cover</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const avail = availableOf(p);
                  const cover = p.dailyDemand ? Math.round((avail / p.dailyDemand) * 10) / 10 : 99;
                  const status =
                    avail === 0 ? "out of stock" : avail < p.reorderPoint ? "low stock" : "healthy";
                  return (
                    <tr key={p.sku} className="border-b border-border/50 last:border-0">
                      <td className="p-3">
                        <p className="font-mono text-xs">{p.sku}</p>
                        <p className="text-xs text-muted-foreground">{p.name}</p>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        Zone {p.zone} · {p.bin}
                      </td>
                      <td className="p-3 text-right tabular-nums">{p.onHand}</td>
                      <td className="p-3 text-right tabular-nums text-flow">{p.reserved}</td>
                      <td className="p-3 text-right tabular-nums text-warning">{p.damaged}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{avail}</td>
                      <td className="p-3 text-right text-xs tabular-nums text-muted-foreground">{cover}d</td>
                      <td className="p-3">
                        <Tag tone={status === "healthy" ? "success" : status === "low stock" ? "warning" : "danger"}>
                          {status}
                        </Tag>
                        {p.inboundQty > 0 ? (
                          <p className="mt-1 text-[0.65rem] text-muted-foreground">
                            +{p.inboundQty} in {p.inboundEtaDays}d
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHead title="Reorder recommendations" subtitle="Lead-time demand + open shortfall − inbound" />
          <div className="space-y-3">
            {recs.map((r) => {
              const prod = products.find((p) => p.sku === r.sku)!;
              return (
                <div key={r.sku} className="panel p-4">
                  <div className="flex items-center gap-2">
                    <Tag tone={r.urgency === "stockout" ? "danger" : "warning"}>{r.urgency}</Tag>
                    <span className="font-mono text-xs">{r.sku}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{r.daysOfCover}d cover</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{r.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.rationale}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => raisePO(r.sku, r.suggestedQty)}>
                      <PackagePlus className="size-4" /> Raise PO · {r.suggestedQty}
                    </Button>
                    {prod.inboundQty > 0 ? (
                      <Button size="sm" variant="secondary" onClick={() => receivePO(r.sku)}>
                        <TruckElectric className="size-4" /> Receipt {prod.inboundQty}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {recs.length === 0 ? (
              <p className="text-sm text-muted-foreground">All SKUs above reorder point with healthy cover.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
