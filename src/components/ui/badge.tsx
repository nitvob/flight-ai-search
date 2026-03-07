import * as React from "react";

import { cn } from "@/lib/utils";

function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-[color:var(--color-border)] bg-white/70 px-3 py-1 text-xs font-medium text-[var(--color-ink)]",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
