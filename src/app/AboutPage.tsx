import {
  ChevronLeft,
  MapPin,
  Phone,
  Mail,
  Linkedin,
  Twitter,
  Award,
  Users,
  Truck,
  Globe,
  ArrowRight,
} from "lucide-react";

const sans = { fontFamily: "'DM Sans', sans-serif" };
const display = { fontFamily: "'Barlow Condensed', sans-serif" };
const mono = { fontFamily: "'DM Mono', monospace" };

const TIMELINE = [
  {
    year: "2008",
    title: "Founded in Singapore",
    body: "Heavy Rental was incorporated by Marcus Wee and Diego Tan, two former ST Engineering project managers who saw a gap in the market for reliable, fully-serviced heavy machinery rental across Singapore's construction and marine sectors.",
  },
  {
    year: "2011",
    title: "First Fleet Expansion",
    body: "Grew from 12 to 60 units following a landmark contract with JTC Corporation to supply excavation equipment for the Jurong Industrial Estate redevelopment. Opened a second depot in Tuas.",
  },
  {
    year: "2015",
    title: "ISO 45001 & bizSAFE Star Certification",
    body: "Became one of the first Singapore-based equipment rental companies to achieve ISO 45001 occupational health and safety certification and bizSAFE Star status under the WSH Council, setting a new industry benchmark for safe rental practices.",
  },
  {
    year: "2018",
    title: "Expanded to Changi & Woodlands",
    body: "Opened two new regional depots, bringing total fleet to 340 units and enabling same-day deployment island-wide for the first time.",
  },
  {
    year: "2021",
    title: "Digital Operations Platform",
    body: "Launched the Heavy Rental customer portal, AI-assisted quotation engine, and real-time fleet tracking system — reducing average quote turnaround from 3 days to under 2 hours.",
  },
  {
    year: "2024",
    title: "1,200+ Unit Fleet Milestone",
    body: "Crossed 1,200 active rental units, serving 340+ clients across construction, marine, infrastructure, and logistics sectors. Named Best Equipment Rental Company at the Singapore Business Awards for the third consecutive year.",
  },
];

const TEAM = [
  {
    name: "Marcus Wee",
    role: "Co-Founder & CEO",
    location: "Tuas",
    img: "photo-1472099645785-5658abf4ff4e",
    bio: "30 years in heavy construction project management. Former VP of Plant & Equipment at ST Engineering. Holds an MEng Civil Engineering from NUS.",
  },
  {
    name: "Diego Tan",
    role: "Co-Founder & COO",
    location: "Jurong",
    img: "photo-1507003211169-0a1dd7228f2d",
    bio: "Expert in fleet logistics and supply-chain operations. Led equipment procurement for S$4B in infrastructure projects before founding Heavy Rental.",
  },
  {
    name: "Priya Rajan",
    role: "Chief Safety Officer",
    location: "Tuas",
    img: "photo-1573497019940-1c28c88b4f3e",
    bio: "Certified WSH Officer (MOM) with 18 years in occupational health. Architected the Heavy Rental zero-incident programme adopted across all depots.",
  },
  {
    name: "James Ong",
    role: "VP Fleet & Maintenance",
    location: "Changi",
    img: "photo-1500648767791-00dcc994a43e",
    bio: "OEM-certified field engineer trained by Caterpillar and Liebherr. Manages a technician team of 48 across four depots and maintains the 48-hour service cycle.",
  },
  {
    name: "Sarah Lin",
    role: "Head of Digital Products",
    location: "Woodlands",
    img: "photo-1438761681033-6461ffad8d80",
    bio: "Led the build of the Heavy Rental portal and AI quotation engine. Previously senior PM at a leading proptech firm. MSc Computer Science, NTU.",
  },
  {
    name: "Carlos Rodrigues",
    role: "Regional Ops Manager — West",
    location: "Jurong",
    img: "photo-1519085360753-af0119f7cbe7",
    bio: "15 years dispatching and coordinating heavy lift operations. Manages 200+ units across the Jurong and Tuas depots with a 99.1% on-time delivery record.",
  },
];

const DEPOTS = [
  {
    city: "Tuas",
    address: "20 Tuas South Ave 6, Singapore 637607",
    phone: "+65 6262 4200",
    units: 480,
    primary: true,
  },
  {
    city: "Jurong",
    address: "18 Boon Lay Way, Singapore 609966",
    phone: "+65 6265 4110",
    units: 290,
    primary: false,
  },
  {
    city: "Changi",
    address: "8 Changi South Street 1, Singapore 486347",
    phone: "+65 6543 8830",
    units: 250,
    primary: false,
  },
  {
    city: "Woodlands",
    address: "2 Woodlands Sector 1, Singapore 738068",
    phone: "+65 6367 1970",
    units: 180,
    primary: false,
  },
];

const VALUES = [
  {
    icon: Award,
    title: "Zero Compromise on Safety",
    body: "Every unit leaves our depot fully inspected. We will never dispatch equipment we would not operate ourselves.",
  },
  {
    icon: Truck,
    title: "Fleet Integrity",
    body: "Average fleet age of 6 years with OEM-only parts. We retire units before they become a liability, not after.",
  },
  {
    icon: Users,
    title: "People-First Operations",
    body: "Our technicians and operators are full-time employees, not contractors. Their expertise is what our clients are actually renting.",
  },
  {
    icon: Globe,
    title: "Long-Term Partnerships",
    body: "75% of our revenue comes from clients we have worked with for more than 3 years. We build relationships, not transactions.",
  },
];

export function AboutPage({ onHome }: { onHome: () => void }) {
  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <button
            onClick={onHome}
            className="text-2xl font-black tracking-tight text-primary hover:opacity-80 transition-opacity"
            style={display}
          >
            HEAVY<span className="text-foreground"> RENTAL</span>
          </button>
          <button
            onClick={onHome}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={15} /> Back to Portal
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 border-b border-border relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 60px,rgba(255,255,255,.4) 60px,rgba(255,255,255,.4) 61px),repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,255,.4) 60px,rgba(255,255,255,.4) 61px)",
          }}
        />
        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p
              className="text-primary text-xs font-semibold tracking-widest uppercase mb-3"
              style={mono}
            >
              Founded 2008 · Singapore
            </p>
            <h1
              className="text-6xl md:text-8xl font-black text-foreground leading-none mb-6"
              style={display}
            >
              ABOUT
              <br />
              <span className="text-primary">HEAVY</span>
              <br />
              RENTAL
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              We are not a catalogue business. We are operators, technicians,
              and project veterans who built a rental company around one belief:
              the right machine, maintained right, delivered on time — every
              single time.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border border border-border">
            {[
              { value: "16 yrs", label: "In Operation" },
              { value: "1,200+", label: "Fleet Units" },
              { value: "340+", label: "Clients Served" },
              { value: "4", label: "SG Depots" },
            ].map((s) => (
              <div key={s.label} className="bg-background p-8">
                <p
                  className="text-5xl font-black text-primary mb-1"
                  style={display}
                >
                  {s.value}
                </p>
                <p
                  className="text-xs text-muted-foreground uppercase tracking-wider"
                  style={mono}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Values */}
      <section className="py-20 px-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16">
            <div>
              <p
                className="text-primary text-xs font-semibold tracking-widest uppercase mb-3"
                style={mono}
              >
                Why We Exist
              </p>
              <h2
                className="text-4xl md:text-5xl font-black text-foreground mb-6"
                style={display}
              >
                OUR MISSION
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-4">
                Heavy Rental exists to eliminate the productivity gap created by
                unreliable equipment and slow logistics in the construction and
                industrial sectors.
              </p>
              <p className="text-muted-foreground text-base leading-relaxed">
                When a S$50M project stalls because the wrong excavator showed
                up, or the crane was not serviced properly, the cost is not just
                financial. Schedules collapse, crews stand idle, and reputations
                suffer. We built Heavy Rental to make that scenario impossible.
              </p>
            </div>
            <div>
              <p
                className="text-primary text-xs font-semibold tracking-widest uppercase mb-3"
                style={mono}
              >
                What We Stand For
              </p>
              <h2
                className="text-4xl md:text-5xl font-black text-foreground mb-6"
                style={display}
              >
                OUR VALUES
              </h2>
              <div className="space-y-4">
                {VALUES.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex gap-4">
                    <div className="w-9 h-9 bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground mb-0.5">
                        {title}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 px-6 border-b border-border bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <p
            className="text-primary text-xs font-semibold tracking-widest uppercase mb-3"
            style={mono}
          >
            16 Years of Growth
          </p>
          <h2
            className="text-4xl md:text-5xl font-black text-foreground mb-14"
            style={display}
          >
            OUR HISTORY
          </h2>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[72px] top-0 bottom-0 w-px bg-border hidden md:block" />
            <div className="space-y-10">
              {TIMELINE.map((item, i) => (
                <div key={i} className="flex gap-8 md:gap-12 items-start">
                  <div className="shrink-0 w-16 text-right">
                    <span
                      className="text-2xl font-black text-primary"
                      style={display}
                    >
                      {item.year}
                    </span>
                  </div>
                  {/* Dot */}
                  <div className="hidden md:flex shrink-0 items-center justify-center w-9 h-9 rounded-full bg-primary/15 border border-primary/30 -ml-[18px] mt-0.5 z-10">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  </div>
                  <div className="bg-card border border-border p-5 flex-1">
                    <h3
                      className="text-xl font-black text-foreground mb-2"
                      style={display}
                    >
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-20 px-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <p
            className="text-primary text-xs font-semibold tracking-widest uppercase mb-3"
            style={mono}
          >
            The People Behind the Fleet
          </p>
          <h2
            className="text-4xl md:text-5xl font-black text-foreground mb-12"
            style={display}
          >
            LEADERSHIP TEAM
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TEAM.map((person) => (
              <div
                key={person.name}
                className="bg-card border border-border p-5"
              >
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={`https://images.unsplash.com/${person.img}?w=120&h=120&fit=crop&face&auto=format`}
                    alt={person.name}
                    className="w-14 h-14 object-cover border border-border"
                  />
                  <div>
                    <p
                      className="font-black text-foreground text-base leading-tight"
                      style={display}
                    >
                      {person.name}
                    </p>
                    <p className="text-xs text-primary font-semibold mt-0.5">
                      {person.role}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />
                      {person.location}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {person.bio}
                </p>
                <div className="flex gap-2 mt-4">
                  <button className="p-1.5 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors">
                    <Linkedin size={13} />
                  </button>
                  <button className="p-1.5 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors">
                    <Twitter size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depot Locations */}
      <section className="py-20 px-6 border-b border-border bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <p
            className="text-primary text-xs font-semibold tracking-widest uppercase mb-3"
            style={mono}
          >
            Island-Wide Coverage
          </p>
          <h2
            className="text-4xl md:text-5xl font-black text-foreground mb-12"
            style={display}
          >
            OUR DEPOTS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {DEPOTS.map((depot) => (
              <div
                key={depot.city}
                className={`bg-card border p-6 ${depot.primary ? "border-primary/40" : "border-border"}`}
              >
                {depot.primary && (
                  <span
                    className="inline-block px-2 py-0.5 text-xs font-bold border border-primary/30 bg-primary/10 text-primary uppercase tracking-wider mb-3"
                    style={mono}
                  >
                    HQ
                  </span>
                )}
                <h3
                  className="text-2xl font-black text-foreground mb-2"
                  style={display}
                >
                  {depot.city}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3 flex items-start gap-1.5">
                  <MapPin size={11} className="mt-0.5 shrink-0" />
                  {depot.address}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-4">
                  <Phone size={11} />
                  {depot.phone}
                </p>
                <div className="pt-4 border-t border-border">
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5"
                    style={mono}
                  >
                    Units Based Here
                  </p>
                  <p
                    className="text-3xl font-black text-foreground"
                    style={display}
                  >
                    {depot.units}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-12">
            <div>
              <p
                className="text-primary text-xs font-semibold tracking-widest uppercase mb-3"
                style={mono}
              >
                Get in Touch
              </p>
              <h2
                className="text-4xl md:text-5xl font-black text-foreground"
                style={display}
              >
                CONTACT US
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {[
              {
                icon: Phone,
                label: "General Enquiries",
                value: "+65 6262 4200",
                sub: "Mon – Fri, 8 AM – 6 PM SGT",
              },
              {
                icon: Mail,
                label: "Email",
                value: "hello@heavyrental.com",
                sub: "Response within 2 business hours",
              },
              {
                icon: Globe,
                label: "24 / 7 Dispatch",
                value: "+65 6262 4299",
                sub: "Equipment emergencies, active rentals",
              },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div
                key={label}
                className="bg-card border border-border p-6 flex gap-4"
              >
                <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider mb-1"
                    style={mono}
                  >
                    {label}
                  </p>
                  <p className="text-base font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="border border-primary/30 bg-primary/5 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3
                className="text-3xl font-black text-foreground mb-1"
                style={display}
              >
                READY TO WORK WITH US?
              </h3>
              <p className="text-sm text-muted-foreground">
                Browse our full fleet and get an instant AI-powered quotation.
              </p>
            </div>
            <button
              onClick={onHome}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-bold text-sm tracking-widest uppercase hover:brightness-110 transition-all shrink-0"
            >
              Browse Equipment <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
