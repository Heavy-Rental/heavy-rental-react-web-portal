import { useState } from "react";
import { ArrowRight, MapPin, Calendar, Award, ChevronLeft, X, Users, Wrench, Clock, TrendingUp } from "lucide-react";

const sans    = { fontFamily: "'DM Sans', sans-serif" };
const display = { fontFamily: "'Barlow Condensed', sans-serif" };
const mono    = { fontFamily: "'DM Mono', monospace" };

interface Project {
  id: number;
  title: string;
  client: string;
  location: string;
  category: string;
  duration: string;
  completedDate: string;
  budget: string;
  equipment: string[];
  summary: string;
  challenge: string;
  outcome: string;
  img: string;
  tags: string[];
  teamSize: number;
  volumeMoved?: string;
  liftCapacity?: string;
  hoursOperated: number;
  status: "Completed" | "Active" | "Upcoming";
}

const PROJECTS: Project[] = [
  {
    id: 1,
    title: "Bayou Crossing Bridge Foundation",
    client: "Ironclad Construction",
    location: "Houston, TX",
    category: "Excavation",
    duration: "14 weeks",
    completedDate: "Mar 2025",
    budget: "$2.4M",
    equipment: ["CAT 320 Hydraulic Excavator", "Komatsu D65 Bulldozer"],
    summary: "Deep foundation excavation for a 240 m river crossing bridge, requiring precision work within 2 m of active utility corridors.",
    challenge: "The project required excavating 18,000 m³ of clay-heavy soil in a flood-prone zone with a 6-week weather window before the wet season.",
    outcome: "Delivered 3 days ahead of schedule. Zero safety incidents. Foundation poured on time, enabling the superstructure phase to begin without delay.",
    img: "photo-1504307651254-35680f356dfd",
    tags: ["Bridge", "Foundation", "Heavy Excavation"],
    teamSize: 12,
    volumeMoved: "18,000 m³",
    hoursOperated: 2840,
    status: "Completed",
  },
  {
    id: 2,
    title: "Midtown Tower Structural Steel Lift",
    client: "Vertex Earthworks",
    location: "Dallas, TX",
    category: "Crane Operations",
    duration: "8 weeks",
    completedDate: "May 2025",
    budget: "$1.8M",
    equipment: ["Liebherr LTM 1100 Mobile Crane"],
    summary: "28-floor commercial tower erection in a constrained downtown block, coordinating 340 precision lifts of structural steel columns and beams.",
    challenge: "Operating a 100-tonne crane within 4 m of an active rail line, with a mandatory 90-minute shutdown window around train schedules each day.",
    outcome: "All 340 lifts completed without a single re-lift. Steel erection finished 5 days early, saving the client an estimated $180K in standby costs.",
    img: "photo-1486325212027-8081e485255e",
    tags: ["High-Rise", "Steel Erection", "Urban Lift"],
    teamSize: 8,
    liftCapacity: "100 t",
    hoursOperated: 1920,
    status: "Completed",
  },
  {
    id: 3,
    title: "Greenfield Solar Farm Site Prep",
    client: "Stellrecht Grading Co.",
    location: "San Antonio, TX",
    category: "Grading & Earthworks",
    duration: "10 weeks",
    completedDate: "Jun 2025",
    budget: "$980K",
    equipment: ["Komatsu D65 Bulldozer", "Dynapac CA2500 Compactor"],
    summary: "340-acre greenfield site graded to a ±50 mm tolerance for a 150 MW utility-scale solar farm, with access roads and drainage channels cut simultaneously.",
    challenge: "The site had 7 m of elevation variation across its width. Final grade tolerance of ±50 mm had to be maintained across the entire 340-acre footprint.",
    outcome: "Grade tolerance achieved across 100% of the site on first pass. Topsoil stockpiled for reuse, saving $62K in disposal costs.",
    img: "photo-1509391366360-2e959784a276",
    tags: ["Solar", "Grading", "Large-Scale Earthworks"],
    teamSize: 10,
    volumeMoved: "42,000 m³",
    hoursOperated: 3100,
    status: "Completed",
  },
  {
    id: 4,
    title: "Port Logistics Hub Expansion",
    client: "Apex Marine Logistics",
    location: "Galveston, TX",
    category: "Lifting & Transport",
    duration: "6 weeks",
    completedDate: "Jul 2025",
    budget: "$1.2M",
    equipment: ["Toyota 8FBE15 Electric Forklift", "Liebherr LTM 1100 Mobile Crane"],
    summary: "Expansion of a deep-water port's container staging area, including installation of four 80-tonne quay fenders and repositioning of 12 container cranes.",
    challenge: "All lifts had to be coordinated around live vessel berthing schedules with maximum 2-hour exclusion windows and zero tolerance for delays.",
    outcome: "All fender installations completed within scheduled windows. Port returned to full operation 11 days ahead of the contractual re-opening date.",
    img: "photo-1558618666-fcd25c85cd64",
    tags: ["Port", "Marine", "Heavy Lift"],
    teamSize: 14,
    liftCapacity: "80 t",
    hoursOperated: 1440,
    status: "Completed",
  },
  {
    id: 5,
    title: "I-45 Highway Corridor Widening",
    client: "TxDOT — District 12",
    location: "Houston, TX",
    category: "Excavation",
    duration: "22 weeks",
    completedDate: "Jan 2025",
    budget: "$5.1M",
    equipment: ["CAT 320 Hydraulic Excavator", "Volvo EC480E Excavator", "Komatsu D65 Bulldozer"],
    summary: "14 km highway widening project adding two lanes in each direction, including full interchange reconstruction at three major intersections.",
    challenge: "Live traffic had to be maintained at all times. Night-only excavation windows (10 PM – 5 AM) restricted operating hours, requiring precise shift handovers.",
    outcome: "Full 14 km corridor delivered on schedule. Zero lane closure incidents reported. Ranked #1 in TxDOT's annual contractor performance review for 2025.",
    img: "photo-1545558014-8692077e9b5c",
    tags: ["Highway", "Infrastructure", "Multi-Equipment"],
    teamSize: 22,
    volumeMoved: "95,000 m³",
    hoursOperated: 6200,
    status: "Completed",
  },
  {
    id: 6,
    title: "Riverside District Mixed-Use Development",
    client: "Hartwell Developments",
    location: "Austin, TX",
    category: "Excavation",
    duration: "18 weeks",
    completedDate: "",
    budget: "$3.3M",
    equipment: ["CAT 320 Hydraulic Excavator", "Volvo EC480E Excavator"],
    summary: "Basement excavation and shoring for a 4-tower mixed-use development on a riverside brownfield site, including environmental remediation of legacy fill material.",
    challenge: "Groundwater table sits 3.2 m below grade. Continuous dewatering and real-time ground settlement monitoring required throughout excavation.",
    outcome: "Phase 1 basement poured. Phase 2 excavation currently underway. On schedule for Q4 2025 structural completion.",
    img: "photo-1504307651254-35680f356dfd",
    tags: ["Mixed-Use", "Basement", "Brownfield"],
    teamSize: 16,
    volumeMoved: "28,000 m³",
    hoursOperated: 3800,
    status: "Active",
  },
  {
    id: 7,
    title: "South Austin Rail Depot Demolition",
    client: "City of Austin",
    location: "Austin, TX",
    category: "Demolition & Clearing",
    duration: "5 weeks",
    completedDate: "Feb 2025",
    budget: "$620K",
    equipment: ["CAT 320 Hydraulic Excavator", "Komatsu D65 Bulldozer"],
    summary: "Selective demolition and site clearing of a decommissioned rail depot, preserving three heritage-listed sandstone facades while removing 14,000 m² of warehouse structure.",
    challenge: "Heritage facades required a 500 mm exclusion buffer. Vibration monitoring was mandatory with automatic equipment shutdown triggers at 3 mm/s peak particle velocity.",
    outcome: "All three heritage facades preserved intact. Concrete and steel recycled at 94% rate. Site cleared and handed over 4 days early.",
    img: "photo-1631549916768-4119b2e5f926",
    tags: ["Demolition", "Heritage", "Urban"],
    teamSize: 9,
    volumeMoved: "14,000 m²",
    hoursOperated: 920,
    status: "Completed",
  },
  {
    id: 8,
    title: "Lone Star Logistics Warehouse Complex",
    client: "Lone Star Industrial",
    location: "San Antonio, TX",
    category: "Lifting & Transport",
    duration: "12 weeks",
    completedDate: "",
    budget: "$2.1M",
    equipment: ["Liebherr LTM 1100 Mobile Crane", "Toyota 8FBE15 Electric Forklift"],
    summary: "Tilt-up concrete panel installation for a 65,000 m² distribution centre, including internal racking system assembly requiring precision forklift placement.",
    challenge: "200 tilt-up panels up to 14 m tall had to be lifted and braced in sequence, with a structural engineer on-site for each panel to verify bracing before release.",
    outcome: "All 200 panels installed and braced within the 12-week programme. Structural sign-off received on schedule. Racking installation commences Q3 2025.",
    img: "photo-1586528116311-ad8dd3c8310d",
    tags: ["Warehouse", "Tilt-Up", "Industrial"],
    teamSize: 18,
    hoursOperated: 2600,
    status: "Active",
  },
];

const CATEGORIES = ["All", "Excavation", "Crane Operations", "Grading & Earthworks", "Lifting & Transport", "Demolition & Clearing"];

const STATUS_STYLE: Record<Project["status"], string> = {
  Completed: "bg-green-500/15 text-green-400 border-green-500/30",
  Active:    "bg-primary/15 text-primary border-primary/30",
  Upcoming:  "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const STATS = [
  { icon: Award,      label: "Projects Delivered",  value: "340+" },
  { icon: Users,      label: "Clients Served",       value: "120+" },
  { icon: Wrench,     label: "Equipment Deployed",   value: "1,200+" },
  { icon: TrendingUp, label: "On-Time Delivery",     value: "98%" },
];

export function ProjectsPage({ onHome }: { onHome: () => void }) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selected, setSelected]         = useState<Project | null>(null);

  const filtered = activeFilter === "All"
    ? PROJECTS
    : PROJECTS.filter(p => p.category === activeFilter);

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <button onClick={onHome} className="text-2xl font-black tracking-tight text-primary hover:opacity-80 transition-opacity" style={display}>
            HEAVY<span className="text-foreground"> RENTAL</span>
          </button>
          <button onClick={onHome} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={15} /> Back to Portal
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 60px,rgba(255,255,255,.4) 60px,rgba(255,255,255,.4) 61px),repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,255,.4) 60px,rgba(255,255,255,.4) 61px)" }} />
        <div className="relative max-w-7xl mx-auto">
          <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-3" style={mono}>Case Studies & Completed Works</p>
          <h1 className="text-6xl md:text-8xl font-black text-foreground leading-none mb-6" style={display}>OUR<br /><span className="text-primary">PROJECTS</span></h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            From high-rise steel erection to highway corridor widening, every Heavy Rental deployment is backed by precision planning, certified operators, and equipment maintained to OEM standards.
          </p>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px mt-14 border border-border bg-border">
            {STATS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-background p-6 flex flex-col gap-2">
                <Icon size={18} className="text-primary" />
                <p className="text-4xl font-black text-foreground" style={display}>{value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider" style={mono}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filter + Grid */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap mb-10">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveFilter(cat)}
                className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-all border ${activeFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(project => (
              <article key={project.id}
                className="group bg-card border border-border hover:border-primary/40 transition-all duration-300 flex flex-col cursor-pointer"
                onClick={() => setSelected(project)}>
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <img
                    src={`https://images.unsplash.com/${project.img}?w=700&h=400&fit=crop&auto=format`}
                    alt={project.title}
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold border ${STATUS_STYLE[project.status]}`}>{project.status}</span>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2 py-0.5 text-xs font-semibold border border-border bg-background/80 text-muted-foreground" style={mono}>{project.category}</span>
                  </div>
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-xl font-black text-foreground leading-tight mb-1" style={display}>{project.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><MapPin size={11} />{project.location}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} />{project.duration}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">{project.summary}</p>

                  <div className="flex gap-2 flex-wrap mb-4">
                    {project.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 text-xs border border-border text-muted-foreground" style={mono}>{t}</span>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Client</p>
                      <p className="text-sm font-semibold text-foreground">{project.client}</p>
                    </div>
                    <div className="flex items-center gap-1 text-primary text-sm font-semibold group-hover:gap-2 transition-all">
                      View case study <ArrowRight size={14} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-24 text-muted-foreground">
              <p className="text-4xl font-black mb-2" style={display}>NO PROJECTS FOUND</p>
              <p className="text-sm">Try a different category filter.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary border-t border-primary/30 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(0,0,0,.3) 40px,rgba(0,0,0,.3) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(0,0,0,.3) 40px,rgba(0,0,0,.3) 41px)" }} />
        <div className="relative max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-black text-primary-foreground leading-none" style={display}>HAVE A PROJECT IN MIND?</h2>
            <p className="text-primary-foreground/70 mt-1 text-sm">Our fleet and operations team are ready to scope your next job.</p>
          </div>
          <button onClick={onHome}
            className="px-8 py-3 bg-primary-foreground text-primary font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all shrink-0">
            Browse Equipment
          </button>
        </div>
      </section>

      {/* Project Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-card border border-border w-full max-w-3xl my-8" style={sans}>
            {/* Modal header image */}
            <div className="relative aspect-video overflow-hidden bg-muted">
              <img
                src={`https://images.unsplash.com/${selected.img}?w=900&h=500&fit=crop&auto=format`}
                alt={selected.title}
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
              <button onClick={() => setSelected(null)}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 p-2 transition-colors">
                <X size={18} className="text-foreground" />
              </button>
              <div className="absolute bottom-4 left-6">
                <span className={`px-2 py-0.5 text-xs font-semibold border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
              </div>
            </div>

            <div className="p-8">
              {/* Title block */}
              <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-1" style={mono}>{selected.category}</p>
              <h2 className="text-4xl font-black text-foreground leading-tight mb-2" style={display}>{selected.title}</h2>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-1.5"><MapPin size={13} />{selected.location}</span>
                <span className="flex items-center gap-1.5"><Clock size={13} />{selected.duration}</span>
                <span className="flex items-center gap-1.5"><Users size={13} />{selected.teamSize} personnel</span>
                {selected.completedDate && <span className="flex items-center gap-1.5"><Calendar size={13} />Completed {selected.completedDate}</span>}
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-8 border border-border bg-border">
                {[
                  { label: "Contract Value",  value: selected.budget },
                  { label: "Hours Operated",  value: selected.hoursOperated.toLocaleString() },
                  { label: selected.volumeMoved ? "Volume Moved" : "Lift Capacity", value: selected.volumeMoved ?? selected.liftCapacity ?? "—" },
                  { label: "Team Size",       value: `${selected.teamSize} people` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1" style={mono}>{label}</p>
                    <p className="text-2xl font-black text-foreground" style={display}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Narrative */}
              <div className="space-y-6 mb-8">
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2" style={mono}>Project Overview</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selected.summary}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2" style={mono}>Key Challenge</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selected.challenge}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2" style={mono}>Outcome</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selected.outcome}</p>
                </div>
              </div>

              {/* Equipment used */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3" style={mono}>Equipment Deployed</h3>
                <div className="flex flex-wrap gap-2">
                  {selected.equipment.map(e => (
                    <span key={e} className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/30 bg-primary/5 text-primary text-xs font-semibold">
                      <Wrench size={11} /> {e}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 pt-6 border-t border-border">
                {selected.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 text-xs border border-border text-muted-foreground" style={mono}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
