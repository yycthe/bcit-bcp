import * as React from "react"
import { cn } from "@/src/lib/utils"

export type BadgeIntent =
  | "default"
  | "secondary"
  | "outline"
  | "brand"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeIntent
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide leading-none",
        {
          "border-transparent bg-foreground text-surface": variant === "default",
          "border-transparent bg-surface-subtle text-foreground-muted": variant === "secondary",
          "border-border text-foreground-muted bg-surface": variant === "outline",
          "border-transparent bg-brand text-brand-foreground": variant === "brand",
          "border-transparent bg-accent text-accent-foreground": variant === "accent",
          "border-success/20 bg-success-soft text-success-foreground": variant === "success",
          "border-warning/30 bg-warning-soft text-warning-foreground": variant === "warning",
          "border-danger/20 bg-danger-soft text-danger-foreground": variant === "danger",
          "border-info/20 bg-info-soft text-info-foreground": variant === "info",
          "border-border bg-surface-subtle text-foreground-muted": variant === "neutral",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
