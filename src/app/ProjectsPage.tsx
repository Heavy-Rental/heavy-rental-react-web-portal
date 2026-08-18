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
    title: "Kallang River Bridge Foundation",
    client: "Ironclad Construction",
    location: "Jurong Port",
    category: "Excavation",
    duration: "14 weeks",
    completedDate: "Mar 2025",
    budget: "S$2.4M",
    equipment: ["CAT 320 Hydraulic Excavator", "Genie GS-1932 Scissors Lift"],
    summary: "Deep foundation excavation for a 240 m river crossing bridge, requiring precision work near active utilities.",
    challenge: "Excavating 18,000 m³ of clay-heavy soil under a tight seasonal weather window.",
    outcome: "Delivered ahead of schedule with zero safety incidents.",
    img: "photo-1504307651254-35680f356dfd",
    tags: ["Bridge", "Foundation", "Heavy Excavation"],
    teamSize: 12,
    volumeMoved: "18,000 m³",
    hoursOperated: 2840,
    status: "Completed",
  },
  {
    id: 2,
    title: "Midtown Tower Elevated Work",
    client: "Vertex Earthworks",
    location: "Marina South",
    category: "Boom Lift Operations",
    duration: "8 weeks",
    completedDate: "May 2025",
    budget: "S$1.8M",
    equipment: ["JLG 1350SJP Telescopic Boom"],
    summary: "High-level facade access and structural lift support for a midtown tower project.",
    challenge: "Coordinating elevated work in a constrained urban block.",
    outcome: "Completed ahead of schedule with efficient lift planning.",
    img: "photo-1486325212027-8081e485255e",
    tags: ["High-Rise", "Facade", "Urban Lift"],
    teamSize: 8,
    hoursOperated: 1920,
    status: "Completed",
  },
  {
    id: 3,
    title: "Greenfield Solar Farm Site Prep",
    client: "Stellrecht Grading Co.",
    location: "Pioneer",
    category: "Grading & Earthworks",
    duration: "10 weeks",
    completedDate: "Jun 2025",
    budget: "S$980K",
    equipment: ["Genie GS-1932 Scissors Lift", "CAT 320 Hydraulic Excavator"],
    summary: "Site grading and access preparation for a utility-scale solar farm.",
    challenge: "Maintain tight grade tolerances across a large site.",
    outcome: "Grade tolerance achieved across the site on first pass.",
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
    location: "Tuas",
    category: "Warehouse Support",
    duration: "6 weeks",
    completedDate: "Jul 2025",
    budget: "S$1.2M",
    equipment: ["Toyota 8FBE15 Electric Fork Lift", "JLG 1350SJP Telescopic Boom"],
    summary: "Container staging and precision forklift placement for quay fender installation.",
    challenge: "Coordinating equipment around live vessel schedules.",
    outcome: "Completed within scheduled windows.",
    img: "photo-1558618666-fcd25c85cd64",
    tags: ["Port", "Marine", "Logistics"],
    teamSize: 14,
    hoursOperated: 1440,
    status: "Completed",
  },
  {
    id: 5,
    title: "PIE Corridor Widening",
    client: "LTA — Land Transport Authority",
    location: "Jurong Port",
    category: "Excavation",
    duration: "22 weeks",
    completedDate: "Jan 2025",
    budget: "S$5.1M",
    equipment: ["CAT 320 Hydraulic Excavator"],
    summary: "Highway widening and interchange reconstruction.",
    challenge: "Maintain live traffic and restricted operating hours.",
    outcome: "Delivered on schedule with zero lane closure incidents.",
    img: "photo-1545558014-8692077e9b5c",
    tags: ["Highway", "Infrastructure"],
    teamSize: 22,
    volumeMoved: "95,000 m³",
    hoursOperated: 6200,
    status: "Completed",
  },
  {
    id: 6,
    title: "Riverside District Mixed-Use Development",
    client: "Hartwell Developments",
    location: "Marina South",
    category: "Excavation",
    duration: "18 weeks",
    completedDate: "",
    budget: "S$3.3M",
    equipment: ["CAT 320 Hydraulic Excavator"],
    summary: "Basement excavation and shoring for a mixed-use development.",
    challenge: "Manage groundwater and continuous dewatering.",
    outcome: "Phase 1 completed; Phase 2 underway.",
    img: "photo-1504307651254-35680f356dfd",
    tags: ["Mixed-Use", "Basement"],
    teamSize: 16,
    hoursOperated: 3800,
    status: "Active",
  },
  {
    id: 7,
    title: "Tanjong Pagar Rail Depot Demolition",
    client: "Singapore Land Authority",
    location: "Tanjong Pagar",
    category: "Demolition & Clearing",
    duration: "5 weeks",
    completedDate: "Feb 2025",
    budget: "S$620K",
    equipment: ["CAT 320 Hydraulic Excavator"],
    summary: "Selective demolition and heritage facade preservation.",
    challenge: "Minimise vibration and protect heritage facades.",
    outcome: "Site cleared and handed over early.",
    img: "photo-1631549916768-4119b2e5f926",
    tags: ["Demolition", "Heritage"],
    teamSize: 9,
    hoursOperated: 920,
    status: "Completed",
  },
  {
    id: 8,
    title: "Tuas Mega Logistics Warehouse Complex",
    client: "PSA International",
    location: "Tuas",
    category: "Warehouse Support",
    duration: "12 weeks",
    completedDate: "",
    budget: "S$2.1M",
    equipment: ["Toyota 8FBE15 Electric Fork Lift", "Genie GS-1932 Scissors Lift"],
    summary: "Tilt-up concrete panel installation and internal racking assembly.",
    challenge: "Coordinate panel lifts and internal racking installation.",
    outcome: "Panels installed and structural sign-off received.",
    img: "photo-1586528116311-ad8dd3c8310d",
    tags: ["Warehouse", "Tilt-Up"],
    teamSize: 18,
    hoursOperated: 2600,
    status: "Active",
  },
];

const CATEGORIES = ["All", "Excavation", "Boom Lift Operations", "Grading & Earthworks", "Warehouse Support", "Demolition & Clearing"];

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
