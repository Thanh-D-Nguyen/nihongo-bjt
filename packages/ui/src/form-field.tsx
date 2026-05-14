import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "./cn";

/* ------------------------------------------------------------------ */
/*  FormField — label + input wrapper with field-level error display  */
/* ------------------------------------------------------------------ */

type FormFieldProps = {
  /** Field label text */
  label: string;
  /** Error message for this field */
  error?: string;
  /** Whether the field is required (shows red asterisk) */
  required?: boolean;
  /** Optional hint text below the input */
  hint?: string;
  /** Wrapping className */
  className?: string;
  children: ReactNode;
};

export function FormField({ label, error, required, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-xs font-medium text-neutral-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-0.5 text-xs text-red-600 flex items-start gap-1" role="alert">
          <svg className="mt-0.5 h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              clipRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              fillRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </p>
      )}
      {hint && !error && (
        <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FormInput — input with error border styling                       */
/* ------------------------------------------------------------------ */

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(function FormInput(
  { className, error, ...props },
  ref
) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
        error
          ? "border-red-400 bg-red-50/50 text-red-900 placeholder:text-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200"
          : "border-slate-200 bg-white text-neutral-900 placeholder:text-neutral-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

/* ------------------------------------------------------------------ */
/*  FormTextarea — textarea with error border styling                 */
/* ------------------------------------------------------------------ */

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
};

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(function FormTextarea(
  { className, error, ...props },
  ref
) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
        error
          ? "border-red-400 bg-red-50/50 text-red-900 placeholder:text-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200"
          : "border-slate-200 bg-white text-neutral-900 placeholder:text-neutral-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

/* ------------------------------------------------------------------ */
/*  FormSelect — select with error border styling                     */
/* ------------------------------------------------------------------ */

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string;
};

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(function FormSelect(
  { className, error, children, ...props },
  ref
) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
        error
          ? "border-red-400 bg-red-50/50 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200"
          : "border-slate-200 bg-white text-neutral-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  );
});

/* ------------------------------------------------------------------ */
/*  FormError — form-level error banner                               */
/* ------------------------------------------------------------------ */

export function FormError({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 flex items-start gap-2",
        className
      )}
      role="alert"
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          clipRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          fillRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FormSuccess — form-level success banner                           */
/* ------------------------------------------------------------------ */

export function FormSuccess({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 flex items-start gap-2",
        className
      )}
      role="status"
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          clipRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          fillRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}
