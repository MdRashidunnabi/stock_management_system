/**
 * Drizzle schema entry point.
 *
 * SQL is the source of truth (see supabase/migrations/*).
 * These exports give Drizzle the table shapes for type-safe queries.
 */

export * from "./_shared";
export * from "./tenants";
export * from "./catalog";
export * from "./suppliers";
export * from "./inventory";
export * from "./sales";
export * from "./customers";
