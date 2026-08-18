export const IDEAL_FOR_BY_CATEGORY: Record<string, string[]> = {
  Excavator: [
    "earthmoving",
    "trenching",
    "demolition",
    "foundation work",
    "digging",
  ],
  "Scissors Lift": [
    "indoor access",
    "installation",
    "elevated work",
    "warehousing",
    "maintenance",
  ],
  "Boom Lift": [
    "aerial work",
    "height",
    "painting",
    "electrical",
    "maintenance",
    "elevated",
  ],
  "Fork Lift": [
    "material handling",
    "warehouse",
    "loading",
    "pallet moving",
    "logistics",
  ],
};

export function deriveTags(item: {
  platformHeight?: number | null;
  capacity?: number;
  condition?: string;
}): string[] {
  const tags: string[] = [];
  if (typeof item.platformHeight === "number")
    tags.push(`${item.platformHeight}m Reach`);
  if (typeof item.capacity === "number")
    tags.push(`${item.capacity}kg Capacity`);
  if (item.condition === "EXCELLENT") tags.push("Like New");
  return tags;
}
