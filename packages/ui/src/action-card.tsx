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
        "group block outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        className
      )}
      href={href}
      {...props}
    >
      <Card className="h-full transition-shadow group-hover:border-[#CBD5E1] group-hover:shadow-[0_4px_6px_-1px_rgba(15,23,42,0.07),0_2px_4px_-1px_rgba(15,23,42,0.04)]">
        <CardContent className="flex gap-4 pt-5">
          {icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-lg text-blue-600">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-[#111827]">{title}</p>
            {description ? <p className="text-sm leading-snug text-[#4B5563]">{description}</p> : null}
            {children}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
