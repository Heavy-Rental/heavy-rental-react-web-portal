import { useState } from "react";
import type { Asset as EquipmentItem, OnboardingMode } from "../../app/types";
import {
  recommendationApi,
  type CreateProjectSpecResponse,
  type ProjectSpecEquipment,
} from "../../app/api";
import { resolveQuoteDates, type QuoteDateRange } from "../../lib/dateFormat";
import { ChooseModeScreen } from "./onboarding/ChooseModeScreen";
import { UploadSpecsScreen } from "./onboarding/UploadSpecsScreen";
import { AnalysingScreen } from "./onboarding/AnalysingScreen";
import { QuoteResultScreen, type RecItem } from "./onboarding/QuoteResultScreen";

function toEquipment(eq: ProjectSpecEquipment): EquipmentItem {
  return {
    minDailyRate: eq.baseDailyRate,
    maxDailyRate: eq.baseDailyRate,
    rating: 0,
    reviews: 0,
    utilization: 0,
    revenue: 0,
    hoursThisMonth: 0,
    idealFor: [],
    serialno: "",
    condition: null,
    lastConditionUpdatedAt: null,
    ...eq,
    weekly: eq.weekly ?? 0,
    tags: eq.tags ?? [],
    img: eq.img ?? "",
  };
}

// ─── Main Onboarding Flow ──────────────────────────────────────────────────

function CustomerOnboarding({ userName, onDone, initialStep = "choose" }: { userName: string; onDone: (mode: OnboardingMode, recs?: EquipmentItem[], quoteDates?: QuoteDateRange) => void; initialStep?: "choose" | "upload" }) {
  const [step, setStep] = useState<"choose" | "upload" | "analysing" | "quote">(initialStep);
  const [uploaded, setUploaded] = useState<File[]>([]);
  const [specsText, setSpecsText] = useState("");
  const [quote, setQuote] = useState<CreateProjectSpecResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setSubmitError(null);
    setStep("analysing");
    const projectText = specsText.trim();
    try {
      const result = uploaded.length > 0
        ? await recommendationApi.createFromProjectSpecMultipart({
            file: uploaded[0],
            projectText: projectText || undefined,
            userName,
          })
        : await recommendationApi.createFromProjectSpec({
            projectText,
            userName,
          });
      setQuote(result);
      setStep("quote");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setStep("upload");
    }
  };

  if (step === "analysing") {
    return <AnalysingScreen />;
  }

  if (step === "quote" && quote) {
    const recItems: RecItem[] = quote.items.map((item) => ({
      eq: toEquipment(item.equipment),
      reason: item.reason,
      lineTotal: item.lineTotal,
      quantity: item.quantity,
      rankOrder: item.rankOrder,
      matchScore: item.matchScore,
    }));

    return (
      <QuoteResultScreen
        quoteRef={quote.quoteRef}
        userName={userName}
        recItems={recItems}
        estimatedTotal={quote.estimatedTotal}
        days={quote.days ?? 1}
        confidenceScore={quote.confidenceScore}
        specSummary={quote.specSummary}
        rationale={quote.rationale}
        onRefine={() => setStep("upload")}
        onAddAll={(eqs) => onDone("specs", eqs, resolveQuoteDates(quote) ?? undefined)}
      />
    );
  }

  if (step === "upload") {
    return (
      <UploadSpecsScreen
        uploaded={uploaded}
        setUploaded={setUploaded}
        specsText={specsText}
        setSpecsText={setSpecsText}
        submitError={submitError}
        onBack={() => setStep("choose")}
        onSubmit={() => void runAnalysis()}
      />
    );
  }

  return (
    <ChooseModeScreen
      userName={userName}
      onKnowWhatIWant={() => onDone("know")}
      onUploadSpecs={() => setStep("upload")}
    />
  );
}

export { CustomerOnboarding };
