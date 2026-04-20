import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/src/lib/utils"

export type KpiTone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info"

interface KpiTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  tone?: KpiTone
  trailing?: React.ReactNode
}

const toneCls: Record<KpiTone, { wrap: string; iconWrap: string; value: string }> = {
  neutral: {
    wrap: "bg-surface border-border",
    iconWrap: "bg-surface-subtle text-foreground-muted",
    value: "text-foreground",
  },
  brand: {
    wrap: "bg-surface border-border",
    iconWrap: "bg-brand-soft text-brand-strong",
    value: "text-foreground",
  },
  accent: {
    wrap: "bg-surface border-border",
    iconWrap: "bg-accent-soft text-accent-strong",
    value: "text-foreground",
  },
  success: {
    wrap: "bg-surface border-border",
    iconWrap: "bg-success-soft text-success",
    value: "text-success-foreground",
  },
  warning: {
    wrap: "bg-surface border-border",
    iconWrap: "bg-warning-soft text-warning",
    value: "text-warning-foreground",
  },
  danger: {
    wrap: "bg-surface border-border",
    iconWrap: "bg-danger-soft text-danger",
    value: "text-danger-foreground",
  },
  info: {
    wrap: "bg-surface border-border",
    iconWrap: "bg-info-soft text-info",
    value: "text-info-foreground",
  },
}

export function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  trailing,
  className,
  ...props
}: KpiTileProps) {
  const meta = toneCls[tone]
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border px-4 py-3.5 shadow-xs",
        meta.wrap,
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-subtle">
          {label}
        </p>
        <div className={cn("mt-1 text-xl font-semibold tracking-tight", meta.value)}>{value}</div>
        {hint && <p className="mt-1 text-xs text-foreground-muted leading-snug">{hint}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              meta.iconWrap
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        {trailing}
      </div>
    </div>
  )
}
