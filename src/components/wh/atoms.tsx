import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { OrderStage, PriorityResult, WarehouseOrder } from "@/lib/warehouse/types";
import { STAGE_LABEL } from "@/lib/warehouse/engine";

export function Tag({
  tone = "muted",
  children,
  className,
}: {
  tone?: "muted" | "primary" | "flow" | "success" | "warning" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground border-border",
    primary: "bg-primary/15 text-primary border-primary/30",
    flow: "bg-flow/15 text-flow border-flow/30",
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-destructive/15 text-destructive border-destructive/35",
  };
  return <span className={cn("tag", tones[tone], className)}>{children}</span>;
}

export function PriorityPill({ prio }: { prio: PriorityResult }) {
  const tone = prio.band === "critical" ? "danger" : prio.band === "high" ? "warning" : "flow";
  return (
    <Tag tone={tone}>
      {prio.band} · {prio.score}
    </Tag>
  );
}

const stageTone: Record<OrderStage, "muted" | "flow" | "primary" | "success" | "danger"> = {
  intake: "muted",
  allocated: "flow",
  picking: "primary",
  packing: "primary",
  qc: "flow",
  dispatched: "success",
  on_hold: "danger",
};

export function StageTag({ stage }: { stage: OrderStage }) {
  return <Tag tone={stageTone[stage]}>{STAGE_LABEL[stage]}</Tag>;
}

export function SlaBar({ order }: { order: WarehouseOrder }) {
  const used = Math.min(100, Math.round((order.placedHoursAgo / order.slaHours) * 100));
  const tone = used >= 100 ? "bg-destructive" : used >= 70 ? "bg-warning" : "bg-success";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${Math.max(4, used)}%` }} />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
  icon?: ReactNode;
}) {
  const accent = {
    default: "text-foreground",
    warning: "text-warning",
    danger: "text-destructive",
    success: "text-success",
  }[tone];
  return (
    <div className="panel grid-lines p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className={cn("mt-2 font-display text-3xl font-bold tabular-nums", accent)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
