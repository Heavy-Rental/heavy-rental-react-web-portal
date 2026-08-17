import { Search } from "lucide-react";
import type { Asset } from "../../app/types";
import type { CartItem } from "../cart/CartContext";
import { mono, display } from "../../lib/styles";

// ─── EQUIPMENT CATALOG / FILTER GRID ──────────────────────────────────────────

export function EquipmentGrid({
  equipment,
  activeFilter,
  onFilterChange,
  highlightId,
  cart,
  sharedStartDate,
  sharedEndDate,
  onSelectDetail,
  onAddToCart,
}: {
  equipment: Asset[];
  activeFilter: string;
  onFilterChange: (f: string) => void;
  highlightId: number | null;
  cart: CartItem[];
  sharedStartDate: string | null;
  sharedEndDate: string | null;
  onSelectDetail: (item: Asset) => void;
  onAddToCart: (item: CartItem) => void;
}) {
  const filters = [
    "All",
    ...Array.from(new Set(equipment.map((e) => e.category))),
  ];
  const filtered = equipment.filter(
    (e) => activeFilter === "All" || e.category === activeFilter,
  );

  return (
    <div className="flex-1 min-w-0">
      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-all border ${activeFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}
          >
            {f}
          </button>
        ))}
      </div>
      {/* Result count */}
      {activeFilter !== "All" && (
        <p className="text-xs text-muted-foreground mb-4" style={mono}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} in{" "}
          <span className="text-foreground">{activeFilter}</span>
          <button
            onClick={() => onFilterChange("All")}
            className="ml-2 text-primary hover:text-primary/80 underline underline-offset-2"
          >
            clear
          </button>
        </p>
      )}
      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="py-20 text-center border border-dashed border-border">
          <Search
            size={28}
            className="text-muted-foreground mx-auto mb-3 opacity-40"
          />
          <p className="font-semibold text-foreground mb-1">
            No equipment found
          </p>
          <p className="text-sm text-muted-foreground">
            Try a different category.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const inCart = cart.some((c) => c.equipment.id === item.id);
          return (
            <div
              key={item.id}
              className={`group bg-card border flex flex-col transition-all duration-300 ${highlightId === item.id ? "border-primary shadow-lg shadow-primary/10" : inCart ? "border-primary/40" : "border-border hover:border-primary/30"}`}
            >
              {/* Clickable image area → detail page */}
              <button
                onClick={() => onSelectDetail(item)}
                className="relative aspect-video bg-muted overflow-hidden text-left w-full"
              >
                <img
                 src={item.img.startsWith("data:") ? item.img : `https://images.unsplash.com/${item.img}?w=600&h=340&fit=crop&auto=format`}

                  alt={item.name}
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="bg-black/70 text-white text-xs font-bold tracking-widest uppercase px-4 py-2 border border-white/20">
                    View Details
                  </span>
                </div>
                <div className="absolute top-3 left-3 flex gap-2">
  {typeof item.available === "boolean" && (
    <span
      className={`px-2 py-0.5 text-xs font-semibold border ${item.available ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
    >
      {item.available ? "Available" : "Booked"}
    </span>
  )}
  {inCart && (
    <span className="px-2 py-0.5 text-xs font-semibold bg-primary text-primary-foreground">
      In Cart
    </span>
  )}
</div>

              </button>
              <div className="p-4 flex flex-col flex-1">
                <p
                  className="text-xs text-primary font-semibold tracking-widest uppercase mb-0.5"
                  style={mono}
                >
                  {item.category}
                </p>
                <button
                  onClick={() => onSelectDetail(item)}
                  className="text-left"
                >
                  <h3
                    className="font-black text-lg text-foreground leading-tight mb-1 hover:text-primary transition-colors"
                    style={display}
                  >
                    {item.name}
                  </h3>
                </button>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  {item.desc}
                </p>
                <div className="flex gap-2 mb-3 flex-wrap">
  {[
    `${item.capacity}t`,
    `${item.purchaseYear}`,
    item.location?.split(",")[0],
  ]
    .filter(Boolean)
    .map((t) => (
      <span
        key={t}
        className="text-xs px-2 py-0.5 bg-secondary/60 text-muted-foreground"
        style={mono}
      >
        {t}
      </span>
    ))}
</div>
                <div className="mt-auto flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      From / day
                    </p>
                    <p
                      className="text-2xl font-black text-foreground"
                      style={display}
                    >
                      S${item.baseDailyRate.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <button
                      disabled={
                        inCart ||
                        !item.available ||
                        !sharedStartDate ||
                        !sharedEndDate
                      }
                      onClick={() =>
                        sharedStartDate &&
                        sharedEndDate &&
                        onAddToCart({
                          equipment: item,
                          startDate: sharedStartDate,
                          endDate: sharedEndDate,
                        })
                      }
                      title={
                        inCart
                          ? "Already in your rental plan"
                          : !sharedStartDate || !sharedEndDate
                            ? "Set your dates in the bar above first"
                            : undefined
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {inCart ? "Added" : "Select"}
                    </button>
                    <button
                      onClick={() => onSelectDetail(item)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                    >
                      View full details →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
