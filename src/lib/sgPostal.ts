const POSTAL_RE = /\b(\d{6})\b/;
const ONEMAP_SEARCH = "https://www.onemap.gov.sg/api/common/elastic/search";

export function extractPostalCode(address: string): string {
  const m = address.trim().match(POSTAL_RE);
  return m ? m[1] : "";
}

export function isSingaporePostal(value: string): boolean {
  return /^\d{6}$/.test(value);
}

type OneMapSearchResponse = {
  results?: Array<{ POSTAL?: string }>;
};

/** Official OneMap search — public GET, returns 6-digit POSTAL for a Singapore address. */
export async function lookupSingaporePostal(
  address: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const q = address.trim();
  if (q.length < 5) return null;
  const url = `${ONEMAP_SEARCH}?searchVal=${encodeURIComponent(q)}&returnGeom=N&getAddrDetails=Y&pageNum=1`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as OneMapSearchResponse;
  const hit = data.results?.find(
    (r) => r.POSTAL && isSingaporePostal(r.POSTAL) && r.POSTAL !== "NIL",
  );
  return hit?.POSTAL ?? null;
}
