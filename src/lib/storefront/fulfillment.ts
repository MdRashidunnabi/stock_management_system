export { MIN_ADVANCE_DAYS } from "@/lib/reports/period";

export type UnavailablePolicy = "substitute" | "omit";

export type DeliveryStage = "preparing" | "prepared_for_delivery" | "on_the_way" | "delivered";

export type CollectionStage = "preparing" | "ready_for_collection" | "collected";

export type FulfillmentStage = DeliveryStage | CollectionStage;

export const DELIVERY_STAGES: Array<{ value: DeliveryStage; label: string }> = [
  { value: "preparing", label: "Preparing" },
  { value: "prepared_for_delivery", label: "Prepared for delivery" },
  { value: "on_the_way", label: "On the way" },
  { value: "delivered", label: "Delivered" },
];

export const COLLECTION_STAGES: Array<{ value: CollectionStage; label: string }> = [
  { value: "preparing", label: "Preparing" },
  { value: "ready_for_collection", label: "Ready for collection" },
  { value: "collected", label: "Collected" },
];

export function stagesForFulfillment(type: string) {
  return type === "takeaway" ? COLLECTION_STAGES : DELIVERY_STAGES;
}

export function fulfillmentStageLabel(stage: string | null | undefined): string {
  const all = [...DELIVERY_STAGES, ...COLLECTION_STAGES];
  return all.find((s) => s.value === stage)?.label ?? "Preparing";
}

export function lineStatusLabel(status: string | null | undefined): string {
  if (status === "substituted") return "Similar product sent";
  if (status === "omitted" || status === "refunded") return "Not sent · refunded";
  return "Confirmed";
}
