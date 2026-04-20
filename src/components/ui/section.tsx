import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/src/lib/utils"

interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  actions?: React.ReactNode
  tone?: "default" | "muted" | "brand" | "accent"
  contentClassName?: string
}

const toneCls: Record<NonNullable<SectionProps["tone"]>, string> = {
  default: "bg-surface border-border",
  muted: "bg-surface-muted border-border",
  brand: "bg-brand-soft/60 border-brand/15",
  accent: "bg-accent-soft border-accent/15",
}

export function Section({
  title,
  description,
  icon: Icon,
  actions,
  tone = "default",
  className,
  contentClassName,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border shadow-xs",
        toneCls[tone],
        className
      )}
      {...props}
    >
      {(title || description || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1 space-y-0.5">
            {title && (
              <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                {Icon && <Icon className="h-4 w-4 text-foreground-muted" />}
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-foreground-muted leading-relaxed">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5 sm:p-6", contentClassName)}>{children}</div>
    </section>
  )
}
