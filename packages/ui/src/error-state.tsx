import type { HTMLAttributes, ReactNode } from "react";

import { EmptyState } from "./empty-state";
import { cn } from "./cn";

export function ErrorState({
  action,
  className,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <EmptyState
      action={action}
      className={cn("border-sakura/25 bg-sakura/5", className)}
      description={description}
      role="alert"
      title={title}
      {...props}
    />
  );
}
