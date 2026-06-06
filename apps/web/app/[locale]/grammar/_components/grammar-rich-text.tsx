"use client";

import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";

import { cn } from "@nihongo-bjt/ui";

const ALLOWED_TAGS = [
  "a",
  "b",
  "br",
  "code",
  "em",
  "h3",
  "h4",
  "i",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "u",
  "ul"
];

const ALLOWED_ATTR = ["href", "rel", "target"];

const blockBreakTags = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|blockquote|section|article)\b[^>]*>/gi;
const htmlTag = /<[^>]+>/g;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function sanitizeGrammarHtml(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_ATTR,
    ALLOWED_TAGS,
    FORBID_TAGS: ["iframe", "script", "style"],
    ADD_ATTR: ["target"],
    RETURN_TRUSTED_TYPE: false
  });
}

export function grammarTextPreview(value: string, maxLength = 180): string {
  const text = decodeHtmlEntities(
    value.replace(blockBreakTags, " ").replace(htmlTag, " ").replace(/\s+/g, " ").trim()
  );

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export function GrammarRichText({ className, html }: { className?: string; html: string }) {
  const safeHtml = useMemo(() => sanitizeGrammarHtml(html), [html]);

  if (!safeHtml.trim()) return null;

  return (
    <div
      className={cn(
        "grammar-rich-text text-sm leading-7 text-ink/82",
        "[&_a]:font-semibold [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_code]:rounded-md [&_code]:bg-ink/6 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.86em] [&_code]:text-ink",
        "[&_em]:text-ink/90 [&_em]:italic",
        "[&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-ink",
        "[&_h4]:mt-3 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-ink",
        "[&_li]:pl-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
        "[&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-ink",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
        className
      )}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
