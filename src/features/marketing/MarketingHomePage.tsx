import { Menu, X, User } from "lucide-react";
import { display, sans } from "../../lib/styles";
import type { Asset as EquipmentItem } from "../../app/types";
import { HeroSection } from "./HeroSection";
import { CategoriesSection } from "./CategoriesSection";
import { EquipmentPreviewSection } from "./EquipmentPreviewSection";
import { CtaBannerSection } from "./CtaBannerSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { FooterSection } from "./FooterSection";

export function MarketingHomePage({
  equipment,
  activeFilter,
  setActiveFilter,
  mobileOpen,
  setMobileOpen,
  onSignIn,
  onNavigate,
}: {
  equipment: EquipmentItem[];
  activeFilter: string;
  setActiveFilter: (f: string) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onSignIn: () => void;
  onNavigate: (view: "projects" | "safety" | "about") => void;
}) {
  const categoryTiles = Array.from(
    new Set(equipment.map((e) => e.category)),
  ).map((cat) => {
    const first = equipment.find((e) => e.category === cat)!;
    return {
      label: cat,
      count: equipment.filter((e) => e.category === cat).length,
      img: first.img,
    };
  });
  const filters = ["All", ...Array.from(new Set(equipment.map((e) => e.category)))];
  const filtered =
    activeFilter === "All"
      ? equipment
      : equipment.filter((e) => e.category === activeFilter);

  const navigateTo = (l: string) => {
    if (l === "Equipment")
      document.getElementById("equipment-section")?.scrollIntoView({ behavior: "smooth" });
    else if (l === "Projects") onNavigate("projects");
    else if (l === "Safety") onNavigate("safety");
    else if (l === "About") onNavigate("about");
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <span
            className="text-2xl font-black tracking-tight text-primary"
            style={display}
          >
            HEAVY<span className="text-foreground"> RENTAL v2</span>
          </span>
          <div className="hidden md:flex items-center gap-8">
            {["Equipment", "Projects", "Safety", "About"].map((l) => (
              <a
                key={l}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo(l);
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {l}
              </a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 hover:border-primary/40 transition-all"
            >
              <User size={14} /> Sign In
            </button>
          </div>
          <button
            className="md:hidden text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-card border-t border-border px-6 py-4 flex flex-col gap-4">
            {["Equipment", "Projects", "Safety", "About"].map((l) => (
              <a
                key={l}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  navigateTo(l);
                }}
                className="text-sm text-muted-foreground"
              >
                {l}
              </a>
            ))}
            <button
              onClick={() => {
                onSignIn();
                setMobileOpen(false);
              }}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold w-full"
            >
              Sign In
            </button>
          </div>
        )}
      </nav>

      <HeroSection />
      <CategoriesSection
        categoryTiles={categoryTiles}
        onSelectCategory={setActiveFilter}
      />
      <EquipmentPreviewSection
        filters={filters}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        filtered={filtered}
        onSignIn={onSignIn}
      />
      <CtaBannerSection onSignIn={onSignIn} />
      <TestimonialsSection />
      <FooterSection />
    </div>
  );
}
