import { ArrowRight } from "lucide-react";
import { mono, display } from "../../lib/styles";

export interface CategoryTile {
  label: string;
  count: number;
  img: string;
}

export function CategoriesSection({
  categoryTiles,
  onSelectCategory,
}: {
  categoryTiles: CategoryTile[];
  onSelectCategory: (label: string) => void;
}) {
  return (
    <section className="py-20 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p
              className="text-primary text-xs font-semibold tracking-widest uppercase mb-2"
              style={mono}
            >
              Browse by Type
            </p>
            <h2 className="text-4xl md:text-5xl font-black text-foreground" style={display}>
              OUR FLEET
            </h2>
          </div>
          <button
            onClick={() =>
              document
                .getElementById("equipment-section")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="hidden md:flex items-center gap-2 text-sm text-primary hover:gap-3 transition-all duration-200"
          >
            View all equipment <ArrowRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categoryTiles.map((cat) => (
            <div
              key={cat.label}
              onClick={() => {
                onSelectCategory(cat.label === "All" ? "All" : cat.label);
                document
                  .getElementById("equipment-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="group relative overflow-hidden cursor-pointer border border-border hover:border-primary/50 transition-all duration-300 bg-card"
            >
              <div className="aspect-[4/3] bg-muted overflow-hidden">
                <img
                  src={`https://images.unsplash.com/${cat.img}?w=400&h=300&fit=crop&auto=format`}
                  alt={cat.label}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-base font-bold text-foreground leading-tight" style={display}>
                  {cat.label}
                </p>
                <p className="text-xs text-primary" style={mono}>
                  {cat.count} units
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
