import type { Equipment } from "../app/types";

export function stubEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 1,
    name: "JLG 1350SJP Telescopic Boom",
    category: "Boom Lift",
    baseDailyRate: 580,
    minDailyRate: 580,
    maxDailyRate: 580,
    weekly: 2600,
    capacity: 1,
    platformHeight: 135,
    purchaseYear: 2023,
    location: "Jurong Port",
    rating: 0,
    reviews: 0,
    available: true,
    img: "photo-1780054984720-20ccf265317f",
    tags: [],
    utilization: 0,
    revenue: 0,
    hoursThisMonth: 0,
    desc: "",
    idealFor: [],
    ...overrides,
  };
}
