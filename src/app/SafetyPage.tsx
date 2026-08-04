import { useState } from "react";
import { ChevronLeft, Shield, AlertTriangle, CheckCircle, Award, Phone, Mail, FileText, Users, Wrench, Eye, ChevronDown, ChevronUp } from "lucide-react";

const sans    = { fontFamily: "'DM Sans', sans-serif" };
const display = { fontFamily: "'Barlow Condensed', sans-serif" };
const mono    = { fontFamily: "'DM Mono', monospace" };

const CERTIFICATIONS = [
  { code: "ISO 45001:2018",     name: "Occupational Health & Safety Management",  body: "Bureau Veritas",       year: "2023", },
  { code: "OSHA 1910/1926",     name: "General Industry & Construction Standards", body: "OSHA Compliance",     year: "2024", },
  { code: "ANSI/ASME B30",      name: "Lifting Equipment & Hook Safety Guidance",      body: "ASME International",  year: "2024", },
  { code: "AS 2550 / AS 4991",  name: "Elevating Work Platform Safety Standards",     body: "Standards Australia",  year: "2023", },
  { code: "NFPA 505",           name: "Fire Safety Standard for Powered Equipment", body: "NFPA",               year: "2024", },
  { code: "API RP 54",          name: "Occupational Safety for Oil & Gas Drilling", body: "API",                year: "2023", },
];

const STATS = [
  { value: "0",      label: "Lost-Time Incidents (2024)",   sub: "Industry avg: 3.2 per 200K hrs" },
  { value: "100%",   label: "Operator Certification Rate",  sub: "All operators OEM-certified" },
  { value: "48hr",   label: "Max Maintenance Interval",     sub: "Pre/post-rental inspection cycle" },
  { value: "6 yrs",  label: "Average Fleet Age",            sub: "Newest unit: 2024 model year" },
];

const PROTOCOLS = [
  {
    icon: Eye,
    title: "Pre-Deployment Inspection",
    steps: [
      "Full walkaround inspection by certified technician",
      "Fluid levels, hydraulic pressure, and electrical systems checked",
      "Load ratings and safety limits verified against manufacturer spec",
      "Photographic condition report generated and shared with client",
      "Operator pre-start checklist signed off before handover",
    ],
  },
  {
    icon: Wrench,
    title: "Ongoing Maintenance Programme",
    steps: [
      "OEM-scheduled preventive maintenance at every 250 operating hours",
      "Hydraulic fluid and filter changes every 500 hours",
      "Non-destructive testing (NDT) of structural welds annually",
      "Tyres and undercarriage inspected after every rental return",
      "Calibrated load cells and rated capacity indicators tested monthly",
    ],
  },
  {
    icon: Users,
    title: "Operator Certification",
    steps: [
      "All operators hold current NCCCO or equivalent national certification",
      "Site-specific inductions completed before first operation",
      "Spotter and signal person training aligned to ASME B30.5",
      "Drug and alcohol policy enforced — zero tolerance on all sites",
      "Annual refresher training with practical assessment required",
    ],
  },
  {
    icon: Shield,
    title: "On-Site Safety Requirements",
    steps: [
      "Exclusion zones established and marked before equipment start",
      "Ground bearing pressure assessed before any tracked/wheeled deployment",
      "Overhead power line clearances verified — minimum 4.5 m enforced",
      "Lift plans mandatory for all lifted loads and complex pick operations over 75% rated capacity",
      "Emergency stop and shutdown procedures posted on every machine",
    ],
  },
];

const FAQS = [
  {
    q: "What certifications do your operators hold?",
    a: "All Heavy Rental operators hold current certifications for elevated work platforms and excavator operation. Excavator operators are OEM-certified through CAT or Volvo training programmes. Certifications are renewed annually and records are available on request.",
  },
  {
    q: "How is equipment inspected before each rental?",
    a: "Every unit undergoes a full pre-deployment inspection by one of our in-house certified technicians. This covers all fluid levels, hydraulic pressure readings, tyre/track condition, electrical systems, safety devices (load indicators, limit switches, e-stops), and structural integrity. A photographic condition report is generated for every rental and shared with the client before the unit leaves our depot.",
  },
  {
    q: "Who is responsible for site safety during the rental?",
    a: "Responsibility is shared. Heavy Rental guarantees the equipment is fit for purpose and safe at point of handover. Once on site, the client's site manager or nominated responsible person is accountable for establishing exclusion zones, confirming ground conditions, and ensuring only certified operators use the equipment. We provide a pre-start safety briefing document with every rental.",
  },
  {
    q: "What happens if a safety defect is found during a rental?",
    a: "Contact our 24/7 equipment safety hotline immediately. Do not continue operating the unit. We will dispatch a field technician within 4 hours for urgent defects. If the unit cannot be made safe on site, we will arrange a like-for-like replacement at no additional charge. All defects are logged in our safety management system and investigated.",
  },
  {
    q: "Do you provide lift plans for lifted operations?",
    a: "Yes. For lifted operations or complex picks, Heavy Rental's certified lift planner will produce a site-specific lift plan including rigging configuration, ground loading calculations, exclusion zone dimensions, and weather limits. Lift plans are available on request.",
  },
  {
    q: "What insurance and liability coverage applies?",
    a: "Heavy Rental carries $20M public liability insurance and $50M products liability cover. Rental agreements include equipment damage waiver options. Clients are required to maintain their own site public liability cover of a minimum $5M. Full insurance certificates are available upon request before rental commencement.",
  },
];

export function SafetyPage({ onHome }: { onHome: () => void }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 40px,rgba(255,255,255,.4) 40px,rgba(255,255,255,.4) 41px)" }} />
        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-500/15 border border-green-500/30 flex items-center justify-center">
              <Shield size={20} className="text-green-400" />
            </div>
            <p className="text-green-400 text-xs font-semibold tracking-widest uppercase" style={mono}>Safety First — Always</p>
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-foreground leading-none mb-6" style={display}>
            SAFETY &<br /><span className="text-green-400">COMPLIANCE</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed mb-12">
            Every piece of equipment that leaves our depot is certified, inspected, and maintained to the highest industry standards. Safety is not a checklist — it is the foundation of every rental.
          </p>

          {/* Stat row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px border border-border bg-border">
            {STATS.map(s => (
              <div key={s.label} className="bg-background p-6">
                <p className="text-4xl font-black text-green-400 mb-1" style={display}>{s.value}</p>
                <p className="text-sm font-semibold text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety Protocols */}
      <section className="py-20 px-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <p className="text-green-400 text-xs font-semibold tracking-widest uppercase mb-3" style={mono}>Our Processes</p>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-12" style={display}>SAFETY PROTOCOLS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PROTOCOLS.map(({ icon: Icon, title, steps }) => (
              <div key={title} className="bg-card border border-border p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <Icon size={17} className="text-green-400" />
                  </div>
                  <h3 className="text-xl font-black text-foreground" style={display}>{title}</h3>
                </div>
                <ul className="space-y-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 px-6 border-b border-border bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <p className="text-green-400 text-xs font-semibold tracking-widest uppercase mb-3" style={mono}>Verified Standards</p>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-12" style={display}>CERTIFICATIONS &<br />COMPLIANCE</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CERTIFICATIONS.map(cert => (
              <div key={cert.code} className="bg-card border border-border p-5 flex gap-4">
                <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Award size={18} className="text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-green-400 tracking-wider mb-0.5" style={mono}>{cert.code}</p>
                  <p className="text-sm font-semibold text-foreground leading-tight">{cert.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{cert.body} · Certified {cert.year}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Compliance note */}
          <div className="mt-10 border border-amber-500/20 bg-amber-500/5 p-6 flex gap-4">
            <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Site-Specific Compliance</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                While Heavy Rental meets or exceeds all listed standards, clients are responsible for ensuring equipment use complies with local council, state, and federal regulations applicable to their specific project site. Our safety team is available to assist with permit applications and method statement preparation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <p className="text-green-400 text-xs font-semibold tracking-widest uppercase mb-3" style={mono}>Common Questions</p>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-10" style={display}>SAFETY FAQs</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-border bg-card">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="text-sm font-semibold text-foreground">{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp size={16} className="text-muted-foreground shrink-0" />
                    : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 border-t border-border">
                    <p className="text-sm text-muted-foreground leading-relaxed pt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Emergency contact */}
      <section className="py-20 px-6 bg-green-950/20 border-t border-green-500/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="text-green-400 text-xs font-semibold tracking-widest uppercase mb-2" style={mono}>24 / 7 Safety Hotline</p>
              <h2 className="text-4xl font-black text-foreground mb-2" style={display}>REPORT A SAFETY CONCERN</h2>
              <p className="text-muted-foreground text-sm max-w-lg">
                If you observe a safety defect, near-miss, or incident involving Heavy Rental equipment, contact us immediately. Do not continue operating a unit you believe is unsafe.
              </p>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <a href="tel:1800429368" className="flex items-center gap-3 px-6 py-3 bg-green-500 hover:bg-green-400 transition-colors text-black font-bold text-sm tracking-widest uppercase">
                <Phone size={16} /> 1-800-HEAVY-ES
              </a>
              <a href="mailto:safety@heavyrental.com" className="flex items-center gap-3 px-6 py-3 border border-green-500/40 text-green-400 hover:bg-green-500/10 transition-colors font-semibold text-sm">
                <Mail size={16} /> safety@heavyrental.com
              </a>
              <a href="#" className="flex items-center gap-3 px-6 py-3 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors text-sm">
                <FileText size={16} /> Download Safety Data Sheets
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
