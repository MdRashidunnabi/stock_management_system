/**
 * Helpers for reading results from next-safe-action when actions are
 * invoked directly in client components (not via useAction).
 */

function hasValidationErrors(validationErrors: unknown): boolean {
  if (validationErrors == null || validationErrors === false) return false;
  if (typeof validationErrors !== "object") return true;

  const v = validationErrors as Record<string, unknown>;

  if ("formErrors" in v || "fieldErrors" in v) {
    const formErrors = v.formErrors;
    if (Array.isArray(formErrors) && formErrors.length > 0) return true;
    const fieldErrors = v.fieldErrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      return Object.values(fieldErrors as Record<string, unknown>).some(
        (errs) => Array.isArray(errs) && errs.length > 0,
      );
    }
    return false;
  }

  return Object.entries(v).some(([key, fieldErr]) => {
    if (key === "_errors" && Array.isArray(fieldErr)) return fieldErr.length > 0;
    if (Array.isArray(fieldErr)) return fieldErr.length > 0;
    if (fieldErr && typeof fieldErr === "object" && "_errors" in fieldErr) {
      const errs = (fieldErr as { _errors?: unknown })._errors;
      return Array.isArray(errs) && errs.length > 0;
    }
    return Boolean(fieldErr);
  });
}

function hasSuccessData(res: unknown): boolean {
  if (!res || typeof res !== "object") return false;
  const data = (res as { data?: unknown }).data;
  return Boolean(
    data && typeof data === "object" && "ok" in data && (data as { ok: boolean }).ok === true,
  );
}

export function getSafeActionError(res: unknown): string | null {
  if (!res || typeof res !== "object") return "No response from server. Please try again.";
  const r = res as { serverError?: string; validationErrors?: unknown };
  if (hasSuccessData(res)) return null;
  if (typeof r.serverError === "string" && r.serverError.length > 0) return r.serverError;
  if (hasValidationErrors(r.validationErrors)) return "Please check the form fields.";
  return null;
}

export function getSafeActionData<T extends { ok: true }>(res: unknown): T | null {
  if (getSafeActionError(res)) return null;
  if (!res || typeof res !== "object") return null;
  const data = (res as { data?: unknown }).data;
  if (data && typeof data === "object" && "ok" in data && (data as { ok: boolean }).ok === true) {
    return data as T;
  }
  return null;
}
