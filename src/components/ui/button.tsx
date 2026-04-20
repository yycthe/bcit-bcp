import * as React from "react"
import { cn } from "@/src/lib/utils"

export type ButtonVariant =
  | "default"
  | "brand"
  | "accent"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "soft"
  | "link"

export type ButtonSize = "default" | "sm" | "lg" | "icon" | "xs"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none",
          {
            "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:translate-y-px":
              variant === "default",
            "bg-brand text-brand-foreground shadow-sm hover:bg-brand-strong active:translate-y-px":
              variant === "brand",
            "bg-accent text-accent-foreground shadow-sm hover:bg-accent-strong active:translate-y-px":
              variant === "accent",
            "bg-danger text-white shadow-sm hover:bg-danger/90 active:translate-y-px":
              variant === "destructive",
            "border border-border bg-surface text-foreground shadow-xs hover:bg-surface-subtle hover:border-border-strong":
              variant === "outline",
            "bg-surface-subtle text-foreground hover:bg-surface-muted":
              variant === "secondary",
            "bg-brand-soft text-brand-strong hover:bg-brand-soft/70":
              variant === "soft",
            "text-foreground hover:bg-surface-subtle":
              variant === "ghost",
            "text-accent underline-offset-4 hover:underline h-auto px-0":
              variant === "link",
            "h-9 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-7 rounded-md px-2.5 text-xs": size === "xs",
            "h-10 rounded-md px-6 text-sm": size === "lg",
            "h-9 w-9 p-0": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
