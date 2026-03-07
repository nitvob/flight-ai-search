import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm text-[var(--color-ink)] outline-none ring-offset-[var(--color-surface)] placeholder:text-[var(--color-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
