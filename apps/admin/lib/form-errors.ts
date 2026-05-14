"use client";

import { useCallback, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type FieldErrors = Record<string, string>;

export type FormErrorState = {
  /** Per-field error messages keyed by field name */
  fields: FieldErrors;
  /** General form-level error (not tied to a specific field) */
  form: string | null;
};

/* ------------------------------------------------------------------ */
/*  useFormErrors hook                                                 */
/* ------------------------------------------------------------------ */

export function useFormErrors() {
  const [errors, setErrors] = useState<FormErrorState>({ fields: {}, form: null });

  /** Set a single field error */
  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({
      ...prev,
      fields: { ...prev.fields, [field]: message },
    }));
  }, []);

  /** Set multiple field errors at once */
  const setFieldErrors = useCallback((fieldErrors: FieldErrors) => {
    setErrors((prev) => ({
      ...prev,
      fields: { ...prev.fields, ...fieldErrors },
    }));
  }, []);

  /** Set form-level error (not field-specific) */
  const setFormError = useCallback((message: string | null) => {
    setErrors((prev) => ({ ...prev, form: message }));
  }, []);

  /** Clear a single field error */
  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const next = { ...prev.fields };
      delete next[field];
      return { ...prev, fields: next };
    });
  }, []);

  /** Clear all errors */
  const clearAll = useCallback(() => {
    setErrors({ fields: {}, form: null });
  }, []);

  /** Get error message for a specific field */
  const fieldError = useCallback(
    (field: string): string | undefined => errors.fields[field],
    [errors.fields]
  );

  /** Whether any errors exist */
  const hasErrors = Object.keys(errors.fields).length > 0 || errors.form !== null;

  return {
    errors,
    fieldError,
    hasErrors,
    setFieldError,
    setFieldErrors,
    setFormError,
    clearFieldError,
    clearAll,
  };
}

/* ------------------------------------------------------------------ */
/*  parseApiError — extract field-level + form-level errors from API  */
/* ------------------------------------------------------------------ */

/**
 * Parse error response from NestJS API.
 * NestJS BadRequestException returns:
 *   { statusCode: 400, message: string | string[], error: "Bad Request" }
 * Or validation pipe returns:
 *   { statusCode: 400, message: [{ field: "email", ... }] }
 * Or plain text error.
 */
export async function parseApiError(
  res: Response,
  fallbackMessage = "Đã xảy ra lỗi. Vui lòng thử lại."
): Promise<{ form: string | null; fields: FieldErrors }> {
  const fields: FieldErrors = {};
  let form: string | null = null;

  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      form = text || `${fallbackMessage} (HTTP ${res.status})`;
      return { form, fields };
    }

    const body = await res.json();

    // NestJS validation pipe: { message: string[] }
    if (Array.isArray(body.message)) {
      for (const msg of body.message) {
        if (typeof msg === "string") {
          // Try to extract field name from message like "email must be an email"
          const fieldMatch = msg.match(/^(\w+)\s/);
          if (fieldMatch) {
            const key = fieldMatch[1];
            fields[key] = msg;
          } else {
            form = form ? `${form}; ${msg}` : msg;
          }
        } else if (msg && typeof msg === "object" && msg.property) {
          // class-validator style: { property: "email", constraints: { isEmail: "..." } }
          const constraints = msg.constraints ?? {};
          const errorMsg = Object.values(constraints).join("; ");
          fields[msg.property] = errorMsg || "Giá trị không hợp lệ";
        }
      }
      if (Object.keys(fields).length === 0 && !form) {
        form = body.message.join("; ");
      }
      return { form, fields };
    }

    // NestJS single message: { message: string }
    if (typeof body.message === "string") {
      // Try to detect field name in the message
      const fieldMatch = body.message.match(/^(\w+)\s(?:must|is|should|cannot|không)/i);
      if (fieldMatch) {
        fields[fieldMatch[1]] = body.message;
      } else {
        form = body.message;
      }
      return { form, fields };
    }

    // Zod flatten format: { fieldErrors: { field: string[] }, formErrors: string[] }
    if (body.fieldErrors && typeof body.fieldErrors === "object") {
      for (const [key, msgs] of Object.entries(body.fieldErrors)) {
        if (Array.isArray(msgs) && msgs.length > 0) {
          fields[key] = (msgs as string[]).join("; ");
        }
      }
      if (Array.isArray(body.formErrors) && body.formErrors.length > 0) {
        form = (body.formErrors as string[]).join("; ");
      }
      return { form, fields };
    }

    // Fallback: use error or message
    form = body.error ?? body.message ?? fallbackMessage;
  } catch {
    form = `${fallbackMessage} (HTTP ${res.status})`;
  }

  return { form, fields };
}

/* ------------------------------------------------------------------ */
/*  Validation helpers                                                */
/* ------------------------------------------------------------------ */

type ValidationRule = {
  field: string;
  value: unknown;
  message: string;
  /** Validation function — return true if valid */
  validate: (v: unknown) => boolean;
};

/**
 * Run a list of validation rules and return field errors.
 * Stops at the first error per field.
 */
export function validateFields(rules: ValidationRule[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const rule of rules) {
    if (errors[rule.field]) continue; // already has error
    if (!rule.validate(rule.value)) {
      errors[rule.field] = rule.message;
    }
  }
  return errors;
}

/** Common validators */
export const validators = {
  required: (v: unknown) =>
    v !== null && v !== undefined && (typeof v === "string" ? v.trim().length > 0 : true),
  minLength: (min: number) => (v: unknown) =>
    typeof v === "string" && v.trim().length >= min,
  isEmail: (v: unknown) =>
    typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  isUrl: (v: unknown) => {
    if (typeof v !== "string" || !v.trim()) return true; // empty is OK (use required for that)
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  },
  isPositiveInt: (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0;
  },
  isNonNegativeInt: (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0;
  },
};
