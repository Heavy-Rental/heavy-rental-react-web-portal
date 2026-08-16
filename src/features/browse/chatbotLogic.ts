import type { Asset } from "../../app/types";

export interface ChatMessage {
  from: "bot" | "user";
  text: string;
}

export type ChatStep = "greeting" | "task" | "load" | "location" | "result";
export interface ChatState {
  step: ChatStep;
  task: string;
  load: number | null;
  location: string;
}

export function getBotResponse(
  state: ChatState,
  userInput: string,
  equipment: Asset[],
): {
  reply: string;
  nextState: ChatState;
  suggestions?: string[];
  recommended?: Asset[];
} {
  if (state.step === "greeting") {
    return {
      reply:
        "Great! What kind of work are you planning? For example: excavation, lifting, grading, warehouse, or aerial work.",
      nextState: { ...state, step: "task" },
      suggestions: [
        "Excavation / Trenching",
        "Elevated / Boom work",
        "Indoor / Compact access",
        "Warehouse / Material handling",
        "Demolition",
      ],
    };
  }
  if (state.step === "task") {
    return {
      reply:
        "Got it. What's the approximate load or material weight you need to handle?",
      nextState: { ...state, step: "load", task: userInput },
      suggestions: [
        "Under 2 tons",
        "2–20 tons",
        "20–50 tons",
        "50–100 tons",
        "Not sure",
      ],
    };
  }
  if (state.step === "load") {
    const input = userInput.toLowerCase();
    let loadNum: number | null = null;
    if (input.includes("under 2") || input.includes("1 ton")) loadNum = 1.5;
    else if (input.includes("2") && input.includes("20")) loadNum = 10;
    else if (input.includes("20") && input.includes("50")) loadNum = 30;
    else if (input.includes("50") || input.includes("100")) loadNum = 80;
    return {
      reply: "Almost there — which city or region is your jobsite in?",
      nextState: { ...state, step: "location", load: loadNum },
      suggestions: ["Jurong Port", "Pioneer", "Tuas", "Marina South", "Other"],
    };
  }
  if (state.step === "location") {
    const task = state.task.toLowerCase();
    const load = state.load;
    const scored = equipment
      .map((e) => ({
        ...e,
        score:
          e.idealFor.reduce((s, kw) => s + (task.includes(kw) ? 3 : 0), 0) +
          (load !== null && e.capacity >= load ? 2 : 0) +
          (e.available ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    return {
      reply: `Based on your project in ${userInput}, here are my top recommendations:`,
      nextState: { ...state, step: "result", location: userInput },
      recommended: scored.slice(0, 2),
    };
  }
  return {
    reply: "Would you like to start over and find a different machine?",
    nextState: { step: "greeting", task: "", load: null, location: "" },
    suggestions: ["Start over"],
  };
}
