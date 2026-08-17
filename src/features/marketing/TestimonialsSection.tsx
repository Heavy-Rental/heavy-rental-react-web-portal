import { Star } from "lucide-react";
import { mono, display } from "../../lib/styles";

const TESTIMONIALS = [
  {
    name: "Marcus Delgado",
    role: "Site Manager — Ironclad Construction",
    quote:
      "We needed a 100-ton crane on 48-hour notice. Heavy Rental delivered, certified operator included. Saved our project timeline.",
    rating: 5,
  },
  {
    name: "Jennifer Okafor",
    role: "Operations Director — Vertex Earthworks",
    quote:
      "We run 12+ excavators through Heavy Rental month over month. Billing is clean, equipment is well-maintained.",
    rating: 5,
  },
  {
    name: "Brian Stellrecht",
    role: "Owner — Stellrecht Grading Co.",
    quote:
      "As a small contractor, Heavy Rental lets me bid on jobs I'd have had to turn down before.",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <p
            className="text-primary text-xs font-semibold tracking-widest uppercase mb-3"
            style={mono}
          >
            Client Stories
          </p>
          <h2 className="text-5xl font-black text-foreground" style={display}>
            TRUSTED ON SITE
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              className={`p-8 border flex flex-col ${i === 1 ? "bg-primary border-primary" : "bg-card border-border"}`}
            >
              <div className="flex gap-1 mb-6">
                {Array.from({ length: t.rating }).map((_, si) => (
                  <Star
                    key={si}
                    size={14}
                    className={
                      i === 1
                        ? "text-primary-foreground fill-primary-foreground"
                        : "text-primary fill-primary"
                    }
                  />
                ))}
              </div>
              <p
                className={`text-base leading-relaxed flex-1 mb-8 ${i === 1 ? "text-primary-foreground" : "text-foreground"}`}
              >
                "{t.quote}"
              </p>
              <div>
                <p
                  className={`font-black text-lg leading-tight ${i === 1 ? "text-primary-foreground" : "text-foreground"}`}
                  style={display}
                >
                  {t.name}
                </p>
                <p
                  className={`text-xs mt-0.5 ${i === 1 ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                >
                  {t.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
