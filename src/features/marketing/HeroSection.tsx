import { mono, display } from "../../lib/styles";

const STATS = [
  { value: "1,200+", label: "Equipment Units" },
  { value: "98%", label: "On-Time Delivery" },
  { value: "340+", label: "Active Clients" },
  { value: "24/7", label: "Support Available" },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-end overflow-hidden pt-16">
      <div className="absolute inset-0 bg-background">
        <img
          src="https://images.unsplash.com/photo-1653315917834-04a6d84e132e?w=1800&h=1000&fit=crop&auto=format"
          alt="Excavator silhouetted at sunset"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>
      <div className="relative max-w-7xl mx-auto px-6 pb-20 w-full">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="h-px w-8 bg-primary" />
            <span
              className="text-primary text-xs font-semibold tracking-widest uppercase"
              style={mono}
            >
              Heavy Equipment Rentals
            </span>
          </div>
          <h1
            className="text-6xl md:text-8xl font-black leading-none tracking-tight text-foreground mb-6"
            style={display}
          >
            THE RIGHT
            <br />
            MACHINE.
            <br />
            <span className="text-primary">RIGHT NOW.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed">
            Access over 1,200 pieces of certified heavy equipment —
            excavators, cranes, forklifts, and more — delivered to your
            jobsite within 48 hours.
          </p>
          <div className="flex items-center gap-6">
            {STATS.slice(0, 3).map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="text-lg font-black text-primary" style={display}>
                  {s.value}
                </span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
