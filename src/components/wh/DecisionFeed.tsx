import { AlertTriangle, Bot, CircleCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWarehouse } from "@/lib/warehouse/store";

export function DecisionFeed({ limit = 12, className }: { limit?: number; className?: string }) {
  const { logs } = useWarehouse();
  return (
    <div className={cn("panel flex flex-col overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Bot className="size-4 text-primary" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest">Decision log</h3>
        <span className="ml-auto text-xs text-muted-foreground">{logs.length} events</span>
      </div>
      <ol className="max-h-[26rem] divide-y divide-border overflow-y-auto">
        {logs.slice(0, limit).map((l) => {
          const Icon = l.severity === "critical" ? AlertTriangle : l.severity === "warn" ? Zap : CircleCheck;
          const tone =
            l.severity === "critical" ? "text-destructive" : l.severity === "warn" ? "text-warning" : "text-success";
          return (
            <li key={l.id} className="flex gap-3 px-4 py-3">
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm font-semibold">{l.title}</p>
                  <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    {l.kind} · {l.at}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{l.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
