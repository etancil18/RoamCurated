import * as React from "react"
import { cn } from "@/lib/utils"

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-orientation={orientation}
        role="separator"
        className={cn(
          "shrink-0 bg-neutral-200 dark:bg-neutral-700",
          orientation === "horizontal"
            ? "h-px w-full"
            : "w-px h-full",
          className
        )}
        {...props}
      />
    )
  }
)

Separator.displayName = "Separator"

export { Separator }
