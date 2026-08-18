import { mono, display } from "../../lib/styles";
import type { Asset as EquipmentItem } from "../../app/types";

export function EquipmentPreviewSection({
  filters,
  activeFilter,
  setActiveFilter,
  filtered,
  onSignIn,
}: {
  filters: string[];
  activeFilter: string;
  setActiveFilter: (f: string) => void;
  filtered: EquipmentItem[];
  onSignIn: () => void;
}) {
  return (
    <section
      id="equipment-section"
      className="py-20 bg-muted/30 border-t border-border"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <p
              className="text-primary text-xs font-semibold tracking-widest uppercase mb-2"
              style={mono}
            >
              Available Now
            </p>
            <h2 className="text-4xl md:text-5xl font-black text-foreground" style={display}>
              FEATURED EQUIPMENT
            </h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-all border ${activeFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group bg-card border border-border hover:border-primary/40 transition-all duration-300 flex flex-col"
            >
              <div className="relative aspect-video bg-muted overflow-hidden">
                <img
                  src={`https://images.unsplash.com/${item.img}?w=600&h=340&fit=crop&auto=format`}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold border ${item.available ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                  >
                    {item.available ? "Available" : "Booked"}
                  </span>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <p
                  className="text-xs text-primary font-semibold tracking-widest uppercase mb-0.5"
                  style={mono}
                >
                  {item.category}
                </p>
                <h3 className="font-black text-lg text-foreground leading-tight mb-3" style={display}>
                  {item.name}
                </h3>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">From / day</p>
                    <p className="text-2xl font-black text-foreground" style={display}>
                      S${item.baseDailyRate.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={onSignIn}
                    className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
