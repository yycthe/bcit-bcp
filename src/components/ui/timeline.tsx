import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Check } from "lucide-react"
import { cn } from "@/src/lib/utils"

export type TimelineStepStatus = "pending" | "active" | "complete" | "blocked"

export interface TimelineStep {
  id: string
  title: React.ReactNode
  description?: React.ReactNode
  status: TimelineStepStatus
  icon?: LucideIcon
  meta?: React.ReactNode
  children?: React.ReactNode
}

interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: TimelineStep[]
  size?: "sm" | "md"
}

const dotCls: Record<TimelineStepStatus, string> = {
  pending: "bg-surface border-border text-foreground-subtle",
  active: "bg-brand border-brand text-brand-foreground shadow-sm ring-4 ring-brand/15",
  complete: "bg-success border-success text-white",
  blocked: "bg-danger-soft border-danger text-danger-foreground",
}

const titleCls: Record<TimelineStepStatus, string> = {
  pending: "text-foreground-muted",
  active: "text-foreground",
  complete: "text-foreground",
  blocked: "text-danger-foreground",
}

export function Timeline({ steps, size = "md", className, ...props }: TimelineProps) {
  const isSm = size === "sm"
  return (
    <ol
      className={cn("relative", className)}
      {...props}
    >
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1
        const Icon = step.icon
        return (
          <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-3 top-8 -bottom-1 w-px",
                  step.status === "complete" ? "bg-success/40" : "bg-border"
                )}
                style={{ left: isSm ? "0.625rem" : "0.75rem" }}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                isSm ? "h-5 w-5" : "h-6 w-6",
                dotCls[step.status]
              )}
            >
              {step.status === "complete" ? (
                <Check className={cn(isSm ? "h-2.5 w-2.5" : "h-3 w-3")} />
              ) : Icon ? (
                <Icon className={cn(isSm ? "h-2.5 w-2.5" : "h-3 w-3")} />
              ) : (
                <span className={cn("h-1.5 w-1.5 rounded-full bg-current opacity-70")} />
              )}
            </span>
            <div className="flex-1 min-w-0 -mt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className={cn("text-sm font-medium", titleCls[step.status])}>{step.title}</p>
                {step.meta && (
                  <span className="text-[11px] text-foreground-subtle">{step.meta}</span>
                )}
              </div>
              {step.description && (
                <p className="mt-0.5 text-xs text-foreground-muted leading-relaxed">
                  {step.description}
                </p>
              )}
              {step.children && <div className="mt-2">{step.children}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
