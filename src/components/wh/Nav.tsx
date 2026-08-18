import { Link } from "@tanstack/react-router";
import { BarChart3, Boxes, ClipboardList, PackageSearch, Radar, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWarehouse } from "@/lib/warehouse/store";

const links = [
  { to: "/", label: "Control tower", icon: Radar },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/fulfillment", label: "Fulfillment", icon: PackageSearch },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function Nav() {
  const { injectOrder, resetSim } = useWarehouse();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="size-4" />
          </span>
          <span className="font-display text-base font-bold tracking-tight">
            Flow<span className="text-primary">Dock</span>
          </span>
        </Link>

        <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              <l.icon className="size-4" />
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={injectOrder}>
            <Sparkles className="size-4" /> Simulate order
          </Button>
          <Button size="sm" variant="ghost" onClick={resetSim} aria-label="Reset simulation">
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
