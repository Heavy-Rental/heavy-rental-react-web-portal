import { Phone, Mail } from "lucide-react";
import { mono, display } from "../../lib/styles";

const FOOTER_COLUMNS = [
  {
    title: "Equipment",
    links: ["Excavators", "Cranes", "Bulldozers", "Forklifts", "Dump Trucks"],
  },
  {
    title: "Services",
    links: [
      "Daily Rental",
      "Long-Term Lease",
      "Operator Supply",
      "Maintenance",
      "Transport",
    ],
  },
  {
    title: "Company",
    links: ["About Us", "Safety Standards", "Certifications", "Careers", "Press"],
  },
];

export function FooterSection() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          <div className="col-span-2">
            <span
              className="text-3xl font-black tracking-tight text-primary mb-4 block"
              style={display}
            >
              HEAVY<span className="text-foreground"> RENTAL</span>
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-5">
              The industrial equipment rental platform for contractors who
              move fast.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="tel:+6562624200"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone size={14} className="text-primary" />
                (+65) 6262 4200
              </a>
              <a
                href="mailto:fleet@heavyrental.com"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail size={14} className="text-primary" /> fleet@heavyrental.com
              </a>
            </div>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p
                className="text-xs font-semibold text-foreground tracking-widest uppercase mb-4"
                style={mono}
              >
                {col.title}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © 2025 Heavy Rental. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Privacy", "Terms", "Insurance"].map((l) => (
              <a
                key={l}
                href="#"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
