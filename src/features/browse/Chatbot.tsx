import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, User, Bot, X } from "lucide-react";
import type { Asset } from "../../app/types";
import { display, sans } from "../../lib/styles";

interface ChatMessage {
  from: "bot" | "user";
  text: string;
}

// ─── CHATBOT LOGIC ────────────────────────────────────────────────────────────

type ChatStep = "greeting" | "task" | "load" | "location" | "result";
interface ChatState {
  step: ChatStep;
  task: string;
  load: number | null;
  location: string;
}

function getBotResponse(
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

// ─── CHATBOT ──────────────────────────────────────────────────────────────────

export function Chatbot({
  onSelectEquipment,
  equipment,
}: {
  onSelectEquipment: (e: Asset) => void;
  equipment: Asset[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      from: "bot",
      text: "Hi! I'm your equipment assistant. I can help you find the right machine for your job. Ready to get started?",
    },
  ]);
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<ChatState>({
    step: "greeting",
    task: "",
    load: null,
    location: "",
  });
  const [suggestions, setSuggestions] = useState<string[]>([
    "Yes, help me find equipment!",
  ]);
  const [recommended, setRecommended] = useState<Asset[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const {
      reply,
      nextState,
      suggestions: nextSugg,
      recommended: rec,
    } = getBotResponse(chatState, text, equipment);
    setMessages((prev) => [
      ...prev,
      { from: "user", text },
      { from: "bot", text: reply },
    ]);
    setChatState(nextState);
    setSuggestions(nextSugg ?? []);
    setRecommended(rec ?? []);
    setInput("");
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center shadow-2xl hover:brightness-110 transition-all duration-200"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 bg-card border border-border shadow-2xl flex flex-col"
          style={{ height: 480, ...sans }}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
            <div className="w-8 h-8 bg-primary flex items-center justify-center">
              <Bot size={16} className="text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground" style={display}>
                EQUIPMENT ASSISTANT
              </p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />{" "}
                Online
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.from === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-6 h-6 flex items-center justify-center shrink-0 ${m.from === "bot" ? "bg-primary" : "bg-secondary"}`}
                >
                  {m.from === "bot" ? (
                    <Bot size={13} className="text-primary-foreground" />
                  ) : (
                    <User size={13} className="text-muted-foreground" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] px-3 py-2 text-xs leading-relaxed ${m.from === "bot" ? "bg-secondary/60 text-foreground" : "bg-primary text-primary-foreground"}`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {recommended.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                {recommended.map((eq) => (
                  <div
                    key={eq.id}
                    className="border border-border bg-secondary/40 p-3"
                  >
                    <p
                      className="text-xs font-black text-foreground mb-0.5"
                      style={display}
                    >
                      {eq.name}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      S${eq.baseDailyRate.toLocaleString()}/day · {eq.category}
                    </p>
                    <button
                      onClick={() => {
                        onSelectEquipment(eq);
                        setOpen(false);
                      }}
                      className="w-full py-1.5 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase hover:brightness-110 transition-all"
                    >
                      Select This Machine
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setChatState({
                      step: "greeting",
                      task: "",
                      load: null,
                      location: "",
                    });
                    setSuggestions(["Yes, help me find equipment!"]);
                    setRecommended([]);
                    setMessages((prev) => [
                      ...prev,
                      { from: "bot", text: "No problem! Let's start over." },
                    ]);
                  }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors text-center py-1"
                >
                  Start over →
                </button>
              </div>
            )}
            {suggestions.length > 0 && recommended.length === 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-2.5 py-1 border border-primary/40 text-xs text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-150"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-border flex items-center gap-2 px-3 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Type a message…"
              className="flex-1 bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none"
            />
            <button
              onClick={() => send(input)}
              className="w-7 h-7 bg-primary flex items-center justify-center hover:brightness-110 transition-all"
            >
              <Send size={13} className="text-primary-foreground" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
