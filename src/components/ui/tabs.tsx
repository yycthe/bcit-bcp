import * as React from "react"
import { cn } from "@/src/lib/utils"

interface TabsProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  items: { value: T; label: React.ReactNode; badge?: React.ReactNode; disabled?: boolean }[]
  className?: string
  size?: "sm" | "md"
  variant?: "underline" | "segmented"
  ariaLabel?: string
}

export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
  size = "md",
  variant = "underline",
  ariaLabel,
}: TabsProps<T>) {
  if (variant === "segmented") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1 shadow-xs",
          className
        )}
      >
        {items.map((item) => {
          const active = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-all",
                size === "sm" ? "text-xs" : "text-sm",
                active
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground",
                item.disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {item.label}
              {item.badge}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-end gap-1 border-b border-border", className)}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "relative inline-flex items-center gap-2 px-3 py-2.5 -mb-px font-medium transition-colors",
              size === "sm" ? "text-xs" : "text-sm",
              "border-b-2 border-transparent",
              active
                ? "border-brand text-foreground"
                : "text-foreground-muted hover:text-foreground hover:border-border-strong",
              item.disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}
