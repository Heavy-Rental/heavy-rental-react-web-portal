import { Search, ArrowRight, Wrench, CheckCircle } from "lucide-react";
import { mono, display, sans } from "../../../lib/styles";

export function ChooseModeScreen({
  userName,
  onKnowWhatIWant,
  onBrowse,
  onUploadSpecs,
}: {
  userName: string;
  onKnowWhatIWant: () => void;
  onBrowse: () => void;
  onUploadSpecs: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden" style={sans}>
      <div className="absolute inset-0 pointer-events-none">
        <img src="https://images.unsplash.com/photo-1630288214173-a119cf823388?w=1800&h=900&fit=crop&auto=format"
          alt="" className="w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-background/80" />
      </div>
      <div className="relative w-full max-w-2xl">
        <div className="mb-10">
          <span className="text-2xl font-black text-primary" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></span>
        </div>
        <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>Welcome, {userName.split(" ")[0]}</p>
        <h1 className="text-5xl md:text-6xl font-black text-foreground leading-none mb-3" style={display}>
          HOW CAN WE<br />HELP YOU TODAY?
        </h1>
        <p className="text-muted-foreground mb-10 text-sm">Choose the option that best describes where you are in the process.</p>

        <div className="flex flex-col gap-3">
          {[
            { icon: CheckCircle, accent: true, title: "I KNOW WHAT I WANT", sub: "Take me straight to the equipment catalogue to browse and book.", onClick: onKnowWhatIWant },
            { icon: Search, accent: false, title: "I'M JUST BROWSING", sub: "Explore the full fleet at my own pace — no pressure, no commitment.", onClick: onBrowse },
            { icon: Wrench, accent: false, title: "I HAVE SPECS, NEED A RECOMMENDATION", sub: "Upload your project specs — we'll match the right machines for you.", onClick: onUploadSpecs },
          ].map(({ icon: Icon, accent, title, sub, onClick }) => (
            <button key={title} onClick={onClick}
              className="group flex items-center gap-6 p-6 bg-card border border-border hover:border-primary/60 hover:bg-secondary/40 text-left transition-all duration-200">
              <div className={`w-14 h-14 flex items-center justify-center shrink-0 ${accent ? "bg-primary" : "bg-secondary border border-border"}`}>
                <Icon size={24} className={accent ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary transition-colors"} />
              </div>
              <div className="flex-1">
                <p className="font-black text-xl text-foreground mb-1" style={display}>{title}</p>
                <p className="text-sm text-muted-foreground">{sub}</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Need help? Our equipment assistant is available in the portal — just click the chat icon.
        </p>
      </div>
    </div>
  );
}
