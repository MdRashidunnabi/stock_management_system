/**
 * Tenant identity for shop operations always comes from server membership,
 * never from a client-supplied tenant id.
 */
export function resolveActiveTenantId(
  membershipTenantIds: readonly string[],
  cookieTenantId: string | null | undefined,
): string | null {
  if (membershipTenantIds.length === 0) return null;
  if (cookieTenantId && membershipTenantIds.includes(cookieTenantId)) return cookieTenantId;
  return membershipTenantIds[0] ?? null;
}

/** Client-sent tenant ids are ignored unless they match the authenticated tenant. */
export function bindTenantId(
  authenticatedTenantId: string,
  requestedTenantId?: string | null,
): string {
  if (requestedTenantId && requestedTenantId !== authenticatedTenantId) {
    throw new Error("TENANT_MISMATCH");
  }
  return authenticatedTenantId;
}

export function bindActorId(authenticatedUserId: string, requestedUserId?: string | null): string {
  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    throw new Error("ACTOR_MISMATCH");
  }
  return authenticatedUserId;
}
