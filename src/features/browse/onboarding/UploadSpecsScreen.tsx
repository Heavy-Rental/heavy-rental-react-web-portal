import { useRef, useState } from "react";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { mono, display, sans } from "../../../lib/styles";

export function UploadSpecsScreen({
  uploaded,
  setUploaded,
  specsText,
  setSpecsText,
  submitError,
  onBack,
  onSubmit,
}: {
  uploaded: File[];
  setUploaded: (files: File[]) => void;
  specsText: string;
  setSpecsText: (v: string) => void;
  submitError: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setUploaded(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(pdf|doc|docx|txt|csv|xlsx)$/i.test(f.name),
    );
    if (files.length) setUploaded(files);
  };

  const canSubmit = uploaded.length > 0 || specsText.trim().length >= 20;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" style={sans}>
      <div className="w-full max-w-xl">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-8 transition-colors group">
          <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" /> Back
        </button>
        <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>Instant Quotation</p>
        <h2 className="text-4xl font-black text-foreground mb-2 leading-none" style={display}>UPLOAD YOUR SPECS</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Upload your project spec file or paste your requirements below. We'll match the right machines and generate a cost estimate instantly.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed p-8 mb-5 text-center cursor-pointer transition-all duration-200 ${uploaded.length > 0 ? "border-primary/60 bg-primary/5" : dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-secondary/20"}`}>
          <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.csv,.xlsx" onChange={handleFileChange} className="hidden" />
          <div className={`w-14 h-14 border flex items-center justify-center mx-auto mb-4 transition-colors ${uploaded.length > 0 ? "bg-primary border-primary" : dragOver ? "bg-primary/20 border-primary/60" : "bg-secondary border-border"}`}>
            {uploaded.length > 0
              ? <CheckCircle size={24} className="text-primary-foreground" />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={dragOver ? "text-primary" : "text-muted-foreground"}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>}
          </div>
          {uploaded.length > 0 ? (
            <div>
              <p className="text-sm font-black text-foreground mb-2" style={display}>{uploaded.length} FILE{uploaded.length > 1 ? "S" : ""} READY</p>
              <div className="flex flex-col gap-1 mb-3">
                {uploaded.map(f => (
                  <div key={f.name} className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    {f.name}
                    <span className="text-muted-foreground/60">({(f.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ))}
              </div>
              <button onClick={e => { e.stopPropagation(); setUploaded([]); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove files</button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-foreground font-semibold mb-1">{dragOver ? "Drop to upload" : "Drag & drop or click to browse"}</p>
              <p className="text-xs text-muted-foreground">PDF · DOC · DOCX · TXT · CSV · XLSX up to 20 MB</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground px-2">or paste requirements</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Text area */}
        <textarea value={specsText} onChange={e => setSpecsText(e.target.value)} rows={6}
          placeholder={"Describe your project requirements here…\n\ne.g. Commercial foundation project requiring excavation and elevated facade access. Site located at Jurong Port. Duration approx. 3 weeks. Requires indoor fit-out access prior to handover."}
          className="w-full bg-secondary/50 border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors resize-none mb-1" />
        <p className="text-xs text-muted-foreground mb-5">{specsText.trim().length < 20 && specsText.length > 0 ? `${20 - specsText.trim().length} more characters needed` : `${specsText.trim().length} characters`}</p>

        {submitError && (
          <p className="text-xs text-red-400 mb-3" role="alert">{submitError}</p>
        )}
        <button onClick={onSubmit} disabled={!canSubmit}
          className="w-full py-4 bg-primary text-primary-foreground font-black text-sm tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          Generate Instant Quote →
        </button>
        <p className="text-xs text-muted-foreground text-center mt-3">No commitment required · Quote valid for 48 hours · Free of charge</p>
      </div>
    </div>
  );
}
