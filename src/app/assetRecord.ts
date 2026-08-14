import type { Asset, ConditionType } from "./types";

export type { ConditionType };

// Formats the raw enum for display: "NEEDS_REPAIR" -> "Needs Repair".
export function formatCondition(c: ConditionType): string {
  return c.split("_").map(w => w[0] + w.slice(1).toLowerCase()).join(" ");
}

// Maintenance-tracking fields layered on top of catalog data; no API resource
// backs these, so they stay client-only-synthesized, deterministic per equipment id.
export interface AssetRecord {
  id: number;
  name: string;
  category: string;
  purchaseYear: number;
  location: string;
  baseDailyRate: number;
  minDailyRate: number;
  maxDailyRate: number;
  weekly: number;
  capacity: number;
  platformHeight: number | null;
  available: boolean;
  utilization: number;
  hoursThisMonth: number;
  revenue: number;
  tags: string;
  desc: string;
  serialno: string;
  condition: ConditionType;
  lastConditionUpdatedAt: string;
  photo: string | null;
}

// Asset.img is overloaded: an Unsplash photo-id fragment until an admin uploads a real
// photo (Task 3, PUT /api/assets/{id}/image), after which the backend returns a data: URI in
// the same field — branch on the prefix to tell the two apart.
export function resolvePhoto(img: string): string {
  return img.startsWith("data:") ? img : `https://images.unsplash.com/photo-${img}?w=400&q=80`;
}

export function deriveAssetRecord(e: Asset): AssetRecord {
  return {
    ...e,
    tags: e.tags.join(", "),
    serialno: e.serialno,
    condition: e.condition ?? "GOOD",
    lastConditionUpdatedAt: e.lastConditionUpdatedAt ?? "",
    photo: resolvePhoto(e.img),
  };
}
