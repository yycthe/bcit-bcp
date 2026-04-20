import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from "lucide-react"
import { cn } from "@/src/lib/utils"

export type BannerIntent = "info" | "success" | "warning" | "danger" | "neutral"

interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  intent?: BannerIntent
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  actions?: React.ReactNode
  onDismiss?: () => void
}

const intentMeta: Record<
  BannerIntent,
  { wrap: string; iconWrap: string; icon: LucideIcon; title: string; body: string }
> = {
  info: {
    wrap: "border-info/25 bg-info-soft",
    iconWrap: "bg-info/10 text-info",
    icon: Info,
    title: "text-info-foreground",
    body: "text-info-foreground/85",
  },
  success: {
    wrap: "border-success/25 bg-success-soft",
    iconWrap: "bg-success/10 text-success",
    icon: CheckCircle2,
    title: "text-success-foreground",
    body: "text-success-foreground/85",
  },
  warning: {
    wrap: "border-warning/30 bg-warning-soft",
    iconWrap: "bg-warning/15 text-warning",
    icon: AlertTriangle,
    title: "text-warning-foreground",
    body: "text-warning-foreground/85",
  },
  danger: {
    wrap: "border-danger/25 bg-danger-soft",
    iconWrap: "bg-danger/10 text-danger",
    icon: ShieldAlert,
    title: "text-danger-foreground",
    body: "text-danger-foreground/85",
  },
  neutral: {
    wrap: "border-border bg-surface-subtle",
    iconWrap: "bg-surface text-foreground-muted",
    icon: Info,
    title: "text-foreground",
    body: "text-foreground-muted",
  },
}

export function Banner({
  intent = "info",
  title,
  description,
  icon,
  actions,
  onDismiss,
  className,
  children,
  ...props
}: BannerProps) {
  const meta = intentMeta[intent]
  const Icon = icon ?? meta.icon
  return (
    <div
      role={intent === "danger" || intent === "warning" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 shadow-xs",
        meta.wrap,
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          meta.iconWrap
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {title && (
          <p className={cn("text-sm font-semibold leading-snug", meta.title)}>{title}</p>
        )}
        {description && (
          <div className={cn("text-sm leading-relaxed whitespace-pre-wrap", meta.body)}>
            {description}
          </div>
        )}
        {children}
        {actions && <div className="pt-1.5 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            "shrink-0 rounded-md p-1 transition-colors hover:bg-black/5",
            meta.title
          )}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
