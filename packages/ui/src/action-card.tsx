import type { HTMLAttributes, ReactNode } from "react";

import { Card, CardContent } from "./card";
import { cn } from "./cn";

export function ActionCard({
  children,
  className,
  description,
  href,
  icon,
  title,
  ...props
}: HTMLAttributes<HTMLAnchorElement> & {
  description?: string;
  href: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <a
      className={cn(
        "group block outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent-mid focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        className
      )}
      href={href}
      {...props}
    >
      <Card className="h-full border-ink/8 transition-shadow group-hover:border-accent/25 group-hover:shadow-[0_16px_48px_rgba(79,70,229,0.08)]">
        <CardContent className="flex gap-4 pt-5">
          {icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-ink">{title}</p>
            {description ? <p className="text-sm leading-snug text-muted">{description}</p> : null}
            {children}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
