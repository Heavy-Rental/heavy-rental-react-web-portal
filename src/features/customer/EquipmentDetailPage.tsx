import {
  ChevronLeft,
  User,
  LogOut,
  ShoppingCart,
  Upload,
} from "lucide-react";
import { mono, display, sans } from "../../lib/styles";
import { DateRangeBar } from "../../components/DateRangeBar";
import type { Asset as EquipmentItem } from "../../app/types";
import type { CartItem } from "../cart/CartContext";
import { deriveTags, IDEAL_FOR_BY_CATEGORY } from "./equipmentDetail";
import { equipmentImageSrc, isUnsplashPhotoId } from "../browse/equipmentImageSrc";

export function EquipmentDetailPage({
  detailItem,
  equipment,
  cart,
  goHome,
  userName,
  onLogout,
  onOpenProfile,
  onUploadSpecs,
  onToggleCart,
  sharedStartDate,
  sharedEndDate,
  sharedMonth,
  sharedYear,
  setSharedStartDate,
  setSharedEndDate,
  setSharedMonth,
  setSharedYear,
  dateBarOpen,
  setDateBarOpen,
  pendingAutoAddActive,
  onBack,
  onSelect,
}: {
  detailItem: EquipmentItem;
  equipment: EquipmentItem[];
  cart: CartItem[];
  goHome: () => void;
  userName: string;
  onLogout: () => void;
  onOpenProfile: () => void;
  onUploadSpecs: () => void;
  onToggleCart: () => void;
  sharedStartDate: string | null;
  sharedEndDate: string | null;
  sharedMonth: number;
  sharedYear: number;
  setSharedStartDate: (d: string | null) => void;
  setSharedEndDate: (d: string | null) => void;
  setSharedMonth: (m: number) => void;
  setSharedYear: (y: number) => void;
  dateBarOpen: boolean;
  setDateBarOpen: (open: boolean) => void;
  pendingAutoAddActive: boolean;
  onBack: () => void;
  onSelect: (item: EquipmentItem, startDate: string, endDate: string) => void;
}) {
  const inCart = cart.some((c) => c.equipment.id === detailItem.id);
  const liveAvailable =
    equipment.find((e) => e.id === detailItem.id)?.available ??
    detailItem.available;

  const SPEC_ROWS: [string, string][] = [
    ["Category", detailItem.category],
    ["Purchase Year", String(detailItem.purchaseYear)],
    ["Max Capacity", `${detailItem.capacity} tonnes`],
    ["Location", detailItem.location ?? "—"],
    ["Base Daily Rate", `S$${detailItem.baseDailyRate.toLocaleString()}`],
    [
      "Availability",
      typeof liveAvailable === "boolean"
        ? liveAvailable
          ? "Available Now"
          : "Currently On Rent"
        : "—",
    ],
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <button
            onClick={goHome}
            className="text-xl font-black text-primary hover:opacity-80 transition-opacity"
            style={display}
          >
            HEAVY<span className="text-foreground"> RENTAL</span>
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <div className="w-6 h-6 bg-primary/20 border border-primary/40 flex items-center justify-center group-hover:border-primary transition-colors">
                <User size={12} className="text-primary" />
              </div>
              <span>{userName}</span>
              <span
                className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10 group-hover:bg-primary/20 transition-colors"
                style={mono}
              >
                CUSTOMER
              </span>
            </button>
            <button
              onClick={onUploadSpecs}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/40 bg-primary/5 text-xs font-bold tracking-widest uppercase text-primary hover:bg-primary/15 hover:border-primary/70 transition-all"
              style={mono}
            >
              <Upload size={13} /> Upload Specs
            </button>
            <button
              onClick={onToggleCart}
              className="relative flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <ShoppingCart size={15} />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 group"
        >
          <ChevronLeft
            size={14}
            className="group-hover:-translate-x-0.5 transition-transform"
          />
          Back to Equipment Catalog
        </button>

        <DateRangeBar
          sharedStartDate={sharedStartDate}
          sharedEndDate={sharedEndDate}
          sharedMonth={sharedMonth}
          sharedYear={sharedYear}
          setSharedStartDate={setSharedStartDate}
          setSharedEndDate={setSharedEndDate}
          setSharedMonth={setSharedMonth}
          setSharedYear={setSharedYear}
          dateBarOpen={dateBarOpen}
          setDateBarOpen={setDateBarOpen}
          locked={cart.length > 0}
          highlight={pendingAutoAddActive && (!sharedStartDate || !sharedEndDate)}
        />

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: image + gallery */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <div className="relative aspect-video bg-muted overflow-hidden border border-border">
              {equipmentImageSrc(detailItem.img, 900, 520) && (
                <img
                  src={equipmentImageSrc(detailItem.img, 900, 520)!}
                  alt={detailItem.name}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
              <div className="absolute top-4 left-4 flex gap-2">
                {typeof liveAvailable === "boolean" && (
                  <span
                    className={`px-2.5 py-1 text-xs font-bold border ${liveAvailable ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                  >
                    {liveAvailable ? "● Available" : "● On Rent"}
                  </span>
                )}

                {inCart && (
                  <span className="px-2.5 py-1 text-xs font-bold bg-primary text-primary-foreground">
                    In Cart
                  </span>
                )}
              </div>
            </div>
            {/* Thumbnail strip — same image at different crops for demo */}
            <div className="grid grid-cols-3 gap-2">
              {[
                "?w=300&h=180&fit=crop&crop=entropy",
                "?w=300&h=180&fit=crop&crop=center",
                "?w=300&h=180&fit=crop&crop=faces,edges",
              ].map((q, i) => (
                <div
                  key={i}
                  className="aspect-video bg-muted overflow-hidden border border-border opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {(detailItem.img.startsWith("data:") ||
                    isUnsplashPhotoId(detailItem.img)) && (
                    <img
                      src={
                        detailItem.img.startsWith("data:")
                          ? detailItem.img
                          : `https://images.unsplash.com/${detailItem.img}${q}&auto=format`
                      }
                      alt=""
                      className="w-full h-full object-cover"
                      style={
                        detailItem.img.startsWith("data:")
                          ? {
                              transform: "scale(1.7)",
                              transformOrigin: [
                                "10% 10%",
                                "50% 50%",
                                "90% 90%",
                              ][i],
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Ideal For */}
            <div className="bg-card border border-border p-5">
              <p
                className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3"
                style={mono}
              >
                Ideal For
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  detailItem.idealFor ??
                  IDEAL_FOR_BY_CATEGORY[detailItem.category] ??
                  []
                ).map((use) => (
                  <span
                    key={use}
                    className="px-3 py-1 text-xs bg-primary/10 text-primary border border-primary/20 font-semibold"
                  >
                    {use}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: details + CTA */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div>
              <p
                className="text-xs text-primary font-semibold tracking-widest uppercase mb-1"
                style={mono}
              >
                {detailItem.category}
              </p>
              <h1
                className="text-4xl font-black text-foreground leading-none mb-3"
                style={display}
              >
                {detailItem.name}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {detailItem.desc}
              </p>
            </div>

            {/* Pricing */}
            <div className="bg-card border border-border p-5">
              <p
                className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3"
                style={mono}
              >
                Pricing
              </p>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Daily rate
                </p>
                <p
                  className="text-3xl font-black text-foreground"
                  style={display}
                >
                  S${detailItem.baseDailyRate.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Specs table */}
            <div className="bg-card border border-border">
              <p
                className="text-xs font-semibold text-muted-foreground tracking-widest uppercase px-5 pt-4 pb-3 border-b border-border"
                style={mono}
              >
                Specifications
              </p>
              <div className="divide-y divide-border">
                {SPEC_ROWS.map(([label, val]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-5 py-2.5"
                  >
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                    <span
                      className={`text-xs font-semibold text-right ${label === "Availability" ? (detailItem.available ? "text-green-400" : "text-amber-400") : "text-foreground"}`}
                      style={mono}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Statutory compliance badge — client-synthesized, like condition/serialno, not persisted anywhere */}
            {(detailItem.category === "Boom Lift" ||
              detailItem.category === "Excavator") &&
              (detailItem.id % 2 === 0 ? (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/30 text-xs font-semibold text-green-400">
                  🟢 MOM Approved / LE Cert Valid
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-400">
                  🟡 Inspection Due
                </div>
              ))}

            {/* Tags */}
            <div>
              <p
                className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2"
                style={mono}
              >
                Features & Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {(detailItem.tags ?? deriveTags(detailItem)).map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs bg-secondary/60 text-muted-foreground border border-border"
                    style={mono}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-3 sticky top-20">
              <button
                disabled={
                  inCart ||
                  !detailItem.available ||
                  !sharedStartDate ||
                  !sharedEndDate
                }
                onClick={() => {
                  if (sharedStartDate && sharedEndDate) {
                    onSelect(detailItem, sharedStartDate, sharedEndDate);
                  }
                }}
                title={
                  inCart
                    ? "Already in your rental plan"
                    : !sharedStartDate || !sharedEndDate
                      ? "Set your dates in the bar above first"
                      : undefined
                }
                className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground text-sm font-black tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {inCart ? "Added" : "Select"}
              </button>
              {liveAvailable === false && (
                <p className="text-xs text-center text-amber-400">
                  This machine is currently on rent. Check back soon.
                </p>
              )}

              <button
                onClick={onBack}
                className="w-full py-3 border border-border text-muted-foreground text-xs font-bold tracking-widest uppercase hover:text-foreground hover:border-primary/30 transition-all"
              >
                ← Back to Catalog
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
