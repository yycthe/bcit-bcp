import * as React from "react"
import { cn } from "@/src/lib/utils"

export type StatusIntent =
  | "idle"
  | "in_progress"
  | "complete"
  | "needs_review"
  | "needs_signature"
  | "blocked"

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  intent: StatusIntent
  label?: string
  dot?: boolean
}

const intentMeta: Record<StatusIntent, { label: string; cls: string; dot: string }> = {
  idle: {
    label: "Not started",
    cls: "bg-surface-subtle text-foreground-subtle border-border",
    dot: "bg-foreground-subtle/60",
  },
  in_progress: {
    label: "In progress",
    cls: "bg-info-soft text-info-foreground border-info/20",
    dot: "bg-info animate-pulse",
  },
  complete: {
    label: "Complete",
    cls: "bg-success-soft text-success-foreground border-success/20",
    dot: "bg-success",
  },
  needs_review: {
    label: "Needs review",
    cls: "bg-warning-soft text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  needs_signature: {
    label: "Needs signature",
    cls: "bg-warning-soft text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  blocked: {
    label: "Blocked",
    cls: "bg-danger-soft text-danger-foreground border-danger/20",
    dot: "bg-danger",
  },
}

export function StatusPill({ intent, label, dot = true, className, ...props }: StatusPillProps) {
  const meta = intentMeta[intent]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider leading-none",
        meta.cls,
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />}
      {label ?? meta.label}
    </span>
  )
}
