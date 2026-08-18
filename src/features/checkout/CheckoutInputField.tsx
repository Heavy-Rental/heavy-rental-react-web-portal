export function CheckoutInputField({
  label,
  value,
  onChange,
  placeholder,
  maxLen,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLen?: number;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLen}
        className={`w-full bg-secondary/50 border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors ${error ? "border-red-500/60" : "border-border"}`}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
