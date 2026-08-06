import type { Equipment, RentalPlan as ApiRentalPlan } from "../../app/types";
import { calcDeposit } from "../../app/api";
import { daysBetweenISO } from "../../lib/dateFormat";

export interface RentalPlanItem {
  equipmentName: string;
  category: string;
  dailyRate: number;
  days: number;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
}

export interface RentalPlan {
  id: string;
  paidAt: string;
  items: RentalPlanItem[];
  totalCost: number;
  depositPaid: number;
  balanceDue: number;
  status: "Active" | "Completed";
}

export function buildRentalPlanViews(
  apiPlans: ApiRentalPlan[],
  equipment: Equipment[],
  userId: number,
): RentalPlan[] {
  return apiPlans
    .filter((p) => p.userId === userId)
    .map((p) => {
      const items: RentalPlanItem[] = p.items.map((i) => {
        const eq = equipment.find((e) => e.id === i.equipmentId);
        return {
          equipmentName: eq?.name ?? `Equipment #${i.equipmentId}`,
          category: eq?.category ?? "",
          dailyRate: eq?.baseDailyRate ?? 0,
          days: daysBetweenISO(i.startDate, i.endDate),
          startDate: i.startDate,
          endDate: i.endDate,
        };
      });
      const totalCost = items.reduce((s, it) => s + it.dailyRate * it.days, 0);
      const depositPaid = calcDeposit(totalCost);
      return {
        id: `RNT-${String(p.id).padStart(4, "0")}`,
        paidAt: new Date(p.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        items,
        totalCost,
        depositPaid,
        balanceDue: totalCost - depositPaid,
        status: (p.status === "active"
          ? "Active"
          : "Completed") as RentalPlan["status"],
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}
