# Feasibility Study: Instant Quotation — Asset Recommendation Integration

## React Web Portal → Spring Boot REST API → Haystack FastAPI

| Field | Value |
|-------|--------|
| **Document type** | Integration / API feasibility study |
| **Status** | Complete (study only — **not implemented** in portal runtime) |
| **Date** | 2026-08-11 |
| **Version** | 1.2.0 |
| **Portal path** | `heavy-rental-react-web-portal` |
| **UI entry** | Instant Quotation · Upload Specs → YOUR RECOMMENDATIONS (`CustomerOnboarding.tsx`) |
| **Spring Boot** | [Heavy-Rental/heavy-rental-spring-rest-api](https://github.com/Heavy-Rental/heavy-rental-spring-rest-api) |
| **Haystack FastAPI** | [Heavy-Rental/haystack-fast-api](https://github.com/Heavy-Rental/haystack-fast-api) |
| **Portal mock data** | `mock/db.json` (`equipment[]` only — no recommendation resource) |
| **API visibility** | **Portal talks only to Spring public `/api/v1/*`.** Haystack has **no public endpoint** — Spring is the sole caller of Haystack **internal** `/internal/v1/*`. |
| **Call 1 public contract** | `POST /api/v1/recommendations/from-project-spec` returns the **Instant Quotation DTO** (quote + ranked equipment items) — not an ingest-only body. |

---

## 1. Executive summary

### Problem

The portal Instant Quotation flow lets a customer **upload a project-spec file** and/or **paste free-text requirements**, then shows **YOUR RECOMMENDATIONS** (match confidence, ranked machines, line totals). Today that screen is **client-local** (hardcoded category picks + catalog from `GET /equipment`). Product intent is:

```text
User (text block and/or files)
    → React Web Portal  (multipart / JSON POST)
        → Spring Boot REST API  (auth, orchestration, domain SoT, asset enrichment)
            → Haystack FastAPI  (index + KG-1, project knowledge, later rank/price)
```

### Endpoint map (product naming)

**Rule:** There is **no Haystack public endpoint**. The browser never calls Haystack. Spring owns public routes; Haystack is reached only on the internal network via `/internal/v1/*`.

| Call | Spring **public** (Portal → Spring only) | Haystack **internal only** (Spring → Haystack) | Public response (portal) |
|------|------------------------------------------|------------------------------------------------|---------------------------|
| **1** | `POST /api/v1/recommendations/from-project-spec` | (1) `POST /internal/v1/recommendations/submitprojectspecification` then (2) `POST /internal/v1/recommendations/project-knowledge/getassetrecommendations` **inside the same Spring request** | **Instant Quotation DTO** — `quoteRef`, `confidenceScore`, `days`, `estimatedTotal`, `specSummary`, `rationale`, `items[]` with nested `equipment` |
| **2** | `POST /api/v1/recommendations/project-knowledge/query` | `POST /internal/v1/recommendations/project-knowledge/getassetrecommendations` | Optional **Q&A** (`answer`, hits) for chatbot/refine — **not** required for Instant Quotation happy path |

### Verdicts

| Question | Result |
|----------|--------|
| Can portal integrate via Spring only (no direct Haystack)? | **GO** |
| Haystack exposes a public browser-facing API? | **NO** — internal `/internal/v1/*` only; Spring is the sole client |
| Does Spring **public** Call 1 return Instant Quotation cards? | **YES (product contract)** — full Instant Quotation DTO |
| Portal happy path: one POST then YOUR RECOMMENDATIONS? | **GO** — `from-project-spec` alone |
| Spring Call 1 is thin ingest pass-through? | **NO** — Spring **orchestrates** internal ingest + get-assets + Asset enrich + DTO assembly |
| Call 2 public required for Instant Quotation? | **NO** — optional Q&A only |
| Separate public Call 3 needed for happy path? | **NO** — Instant Quotation DTO lives on Call 1 public response |
| Spring has persistence model for recommendations? | **PARTIAL** — entities exist; **no controller/DTO** yet |
| Portal equipment shape available for enrichment? | **GO** — `mock/db.json` `equipment[]` / Spring `Asset` |

**Overall:** **GO** for Instant Quotation with a **single Spring public call**: `POST /api/v1/recommendations/from-project-spec` returns the Instant Quotation DTO. Spring runs a **multi-step internal saga** against Haystack (`submitprojectspecification` then `getassetrecommendations`), enriches fleet from Asset SoT, and never exposes Haystack to the browser. Call 2 public remains optional for Q&A.

---

## 2. As-built inventory

### 2.1 React web portal

| Area | As-built |
|------|----------|
| Upload UI | `CustomerOnboarding` step `upload`: drag/drop file and/or paste text (≥20 chars) |
| Analysis UI | Step `analysing` — client timer only |
| Quote UI | Step `quote` — `QuoteResultScreen` with client-generated `quoteRef` (`QUO-####`), hardcoded `days=21`, category-based recs from loaded equipment |
| Data source | `equipmentApi.list()` → mock/json-server `equipment` from `mock/db.json` |
| AI backend | **None** — comment in code: no AIRecommendation REST yet; field names mirror future entities |

**Portal UI fields on YOUR RECOMMENDATIONS:**

| UI element | Client field today |
|------------|-------------------|
| Header `Instant Quotation · QUO-8691` | `quoteRef` |
| Confidence ring / “91% AI Match Confidence” | `confidenceScore` (0–1) |
| Your Project Spec strip | `specSummary` |
| Rank badge `#1` | `recItems[].rankOrder` |
| Match badge `95% Match` | `recItems[].matchScore` (0–1) |
| Machine name / category / image | `recItems[].eq.*` |
| Why text | `recItems[].reason` |
| Line price | `recItems[].lineTotal` |
| Qty | fixed `1` |
| Estimated total | sum of selected `lineTotal` |
| Agent rationale block | hardcoded copy + `days` |

**Equipment fields used on this page** (subset of `mock/db.json` `equipment`):

`id`, `name`, `category`, `baseDailyRate`, `weekly`, `capacity`, `purchaseYear`, `location`, `available`, `img`, `desc`, `tags`

Present in `db.json` but **not required** for this page: `minDailyRate`, `maxDailyRate`, `platformHeight`, `rating`, `reviews`, `utilization`, `revenue`, `hoursThisMonth`, `idealFor`.

### 2.2 Spring Boot REST API

| Area | As-built (`develop`) |
|------|----------------------|
| Recommendation HTTP | **None** — no public `/api/v1/recommendations/*` controller documented |
| Entities | `AIRecommendation`, `RecommendationItem` (+ repositories) |
| Asset SoT | `Asset` entity + equipment browse APIs (branch-dependent) |
| Role | Intended **BFF / domain orchestrator**: JWT auth, user identity, multipart proxy, persist recommendations, enrich `asset_id` → full asset DTO |

**`AIRecommendation` columns (persistence target):**

| Java field | Column | Type |
|------------|--------|------|
| `id` | `id` | Long PK |
| `user` | `user_id` | FK → User |
| `confidenceScore` | `confidence_score` | BigDecimal(10,2) |
| `status` | `status` | GENERATED \| ACCEPTED \| REJECTED \| EXPIRED |
| `previousRecommendation` | `previous_recommendation_id` | self FK |
| `rawProjectPrompt` | `raw_project_prompt` | TEXT |
| `documentUrl` | `document_url` | String |
| `aiReasoningSummary` | `ai_reasoning_summary` | TEXT |
| `createdAt` | `created_at` | LocalDateTime NOT NULL |

**`RecommendationItem` columns:**

| Java field | Column | Type |
|------------|--------|------|
| `id` | `id` | Long PK |
| `recommendation` | `recommendation_id` | FK → AIRecommendation |
| `asset` | `asset_id` | FK → Asset |
| `rankOrder` | `rank_order` | Integer |
| `matchScore` | `match_score` | BigDecimal |
| `mlPredictedPrice` | `ml_predicted_price` | BigDecimal |

### 2.3 Haystack FastAPI

**Visibility:** Haystack is an **internal service**. It must **not** be exposed as a public portal API. Spring is the only intended HTTP client. All portal-facing recommendation URLs are Spring `/api/v1/*`.

| Haystack **internal** route (Spring → Haystack only) | Behaviour | Used by Spring |
|-----------------------------------------------------|-----------|----------------|
| `POST /internal/v1/recommendations/submitprojectspecification` | Index project text/file + **mandatory KG-1** | Call 1 saga step A |
| `POST /internal/v1/recommendations/project-knowledge/getassetrecommendations` | Asset ranks / scores / pricing (**product target** for Instant Quotation); may also support Q&A for public Call 2 | Call 1 saga step B; optional public Call 2 |

**Portal-facing Instant Quotation body is never Haystack’s raw response** — Spring always returns §5.2.1 Instant Quotation DTO after Asset enrichment. Field shapes for internal payloads are in §5.

---

## 3. Target architecture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Customer browser                                                         │
│  Instant Quotation: paste text and/or upload PDF/DOC/TXT/…               │
│  ★ ONE public POST → Instant Quotation DTO → YOUR RECOMMENDATIONS        │
│  ★ Calls Spring only — never Haystack                                    │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │  HTTPS + Bearer JWT
                                │  POST /api/v1/recommendations/from-project-spec
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Spring Boot REST API          ★ ONLY public surface for the portal       │
│  • Authenticate user                                                     │
│  • Public Call 1: orchestrate saga → return Instant Quotation DTO        │
│  • Public Call 2 (optional): project-knowledge Q&A for chatbot/refine    │
│  • Persist AIRecommendation / RecommendationItem                         │
│  • Enrich asset_id → nested equipment for portal                         │
│  • Internal HTTP client → Haystack (timeouts, circuit breaker, trace id) │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │  Internal network only (not browser-facing)
                                │  POST /internal/v1/recommendations/*
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Haystack FastAPI              ★ NO public endpoint                       │
│  Internal: submitprojectspecification → ingest_id + KG                   │
│  Internal: getassetrecommendations    → asset ranks / scores / pricing   │
│            (used inside Spring Call 1 saga; also for optional public Q&A)│
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Instant Quotation happy path (single public call)

| Step | Who | Action |
|------|-----|--------|
| 0 | Portal | User submits specs (text and/or files) + optional rental dates |
| 1 | Portal → Spring | **One** `POST /api/v1/recommendations/from-project-spec` |
| 1a | Spring → Haystack | Internal `submitprojectspecification` — index + KG → `ingest_id` |
| 1b | Spring → Haystack | Internal `getassetrecommendations` — ranked assets / scores / prices (product target body) |
| 1c | Spring | Join Asset SoT → nested `equipment`; build `quoteRef`, `confidenceScore`, `days`, totals, `rationale` |
| 1d | Spring | Optional: persist `AIRecommendation` + `RecommendationItem` |
| 2 | Spring → Portal | **200 Instant Quotation DTO** |
| 3 | Portal | Render YOUR RECOMMENDATIONS; “Add All to Rental Plan” |

Optional **public Call 2** (`project-knowledge/query`) is for chatbot / refine Q&A only — **not** part of the Instant Quotation happy path.

### 3.2 Haystack internal `getassetrecommendations` body

Used **inside Spring Call 1** (and optionally by public Call 2). Product needs an **asset-oriented** response (or Spring must derive ranks from fleet + project context) so Call 1 can fill `items[]`. A pure Q&A `answer` string alone is **not** sufficient for Instant Quotation cards.

---

## 4. Endpoint catalogue

### 4.0 Visibility rules

| Client | May call | Must not call |
|--------|----------|---------------|
| React portal (browser) | Spring `POST /api/v1/recommendations/*` | Haystack host or any `/internal/v1/*` |
| Spring Boot | Haystack `POST /internal/v1/recommendations/*` (private network) | Expose Haystack URLs to the browser |
| Haystack | N/A as public API | Browser-facing `/api/v1/*` for Instant Quotation |

---

### 4.1 Call 1 — From project spec → Instant Quotation (primary Instant Quotation API)

| Hop | Method | Path | Visibility |
|-----|--------|------|------------|
| Portal → Spring | `POST` | `/api/v1/recommendations/from-project-spec` | **Public** (portal) |
| Spring → Haystack (step A) | `POST` | `/internal/v1/recommendations/submitprojectspecification` | **Internal only** |
| Spring → Haystack (step B) | `POST` | `/internal/v1/recommendations/project-knowledge/getassetrecommendations` | **Internal only** |

**Content-Type:** `application/json` **or** `multipart/form-data`  
**Auth (portal → Spring):** Bearer JWT (recommended; Spring derives `user_id` from principal when possible)  
**Auth (Spring → Haystack):** service key / internal network (TBD; Haystack not browser-authenticated)

**Public response (normative):** Instant Quotation DTO — see §5.2.  
Spring is an **orchestrator**, not a pass-through of the Haystack ingest body. The portal never learns the Haystack base URL.

| Public success body includes | Public success body does **not** require |
|------------------------------|------------------------------------------|
| `quoteRef`, `confidenceScore`, `days`, `estimatedTotal`, `specSummary`, `rationale`, `items[]` + nested `equipment` | Raw `ingest_id`, `kg_*`, `documents[]` (optional debug/extension only) |

---

### 4.2 Call 2 — Project knowledge query (optional Q&A)

| Hop | Method | Path | Visibility |
|-----|--------|------|------------|
| Portal → Spring | `POST` | `/api/v1/recommendations/project-knowledge/query` | **Public** (portal) |
| Spring → Haystack | `POST` | `/internal/v1/recommendations/project-knowledge/getassetrecommendations` | **Internal only** |

**Content-Type:** `application/json`  
**Use case:** Chatbot / refine questions over the ingested project-spec.  
**Not required** for Instant Quotation happy path (YOUR RECOMMENDATIONS is filled by Call 1 alone).

**Prerequisite when used after Call 1:** Spring may hold `ingest_id` server-side from Call 1, or accept it if the portal stores an optional correlation id. Haystack session may be process-local unless `kg_artifact_path` reloads KG.

There is **no** separate Haystack public twin of this route.

---

### 4.3 Public Call 3 — obsolete for Instant Quotation happy path

A separate portal endpoint such as `/api/v1/recommendations/assets` is **not required** for Instant Quotation. The Instant Quotation DTO is the **Call 1 public response**. Internal Haystack steps remain multi-call inside Spring.

---

## 5. Request and response bodies

### 5.1 Call 1 — Request

#### 5.1.1 JSON body (`application/json`)

Normative Haystack model: `RecommendFromProjectSpecRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | **Yes** | Stable user id for tenanting documents / KG (`min_length=1`, trimmed) |
| `user_name` | string \| null | No | Display name for audit / echo |
| `project_text` | string | **Yes** (JSON path) | Unstructured project description (`min_length=1` after trim) |
| `start_date` | date (ISO `YYYY-MM-DD`) \| null | No | Rental window start |
| `end_date` | date (ISO `YYYY-MM-DD`) \| null | No | Rental window end; must be ≥ `start_date` if both set |
| `options.include_pricing` | boolean | No (default `true`) | Prefer priced line totals on Instant Quotation `items[]` when true |

**Example — same logical body on both hops (JSON):**

- Portal → Spring: `POST /api/v1/recommendations/from-project-spec`
- Spring → Haystack: `POST /internal/v1/recommendations/submitprojectspecification`

```json
{
  "user_id": "1",
  "user_name": "Alex Tan",
  "project_text": "Commercial foundation project requiring excavation and elevated facade access. Site at Jurong Port. Duration approx. 3 weeks. Requires indoor fit-out access prior to handover.",
  "start_date": "2026-09-01",
  "end_date": "2026-09-21",
  "options": {
    "include_pricing": true
  }
}
```

**Validation failures → 400** (shared error shape on Haystack; Spring should mirror):

- empty / missing `user_id`
- empty / missing `project_text` (when no file on multipart)
- `end_date` < `start_date`
- unsupported `Content-Type`

#### 5.1.2 Multipart body (`multipart/form-data`)

| Part name | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | text | **Yes** | Same as JSON |
| `user_name` | text | No | Same as JSON |
| `project_text` | text | No* | Free-text; may accompany file |
| `file` | binary | No* | Project-spec file |
| `start_date` | text (date) | No | ISO date |
| `end_date` | text (date) | No | ISO date |
| `include_pricing` | text/boolean | No | Multipart flag (may be flat on internal form; not nested `options`) |

\* At least one of non-empty `project_text` or non-empty `file` required after extract.

**Portal UI alignment:**

| Portal upload UI | Multipart field |
|------------------|-----------------|
| Pasted requirements textarea | `project_text` |
| Drag/drop or file picker | `file` (portal accepts `.pdf,.doc,.docx,.txt,.csv,.xlsx`) |
| (future) date range bar | `start_date` / `end_date` |
| Logged-in customer | Spring should set `user_id` from JWT; portal may omit or echo |

**Haystack as-built MIME support** (indexing capability expands; unsupported → 400):  
MVP text/markdown; PDF/DOCX via converters when enabled; Postman covers `.txt`, `.md`, `.csv`, `.json`, mixed file+text.

#### 5.1.3 Portal → Spring request notes

| Topic | Recommendation |
|-------|----------------|
| Who owns `user_id` | **Spring** from authenticated principal; ignore/override client spoofing |
| Multiple files | Portal UI allows multi-file; Haystack internal ingest typically accepts a single `file` part — Spring should either concatenate text extracts or multi-call ingest policy (open product decision) |
| Max size | Align Spring multipart max with Haystack + portal “20 MB” copy |
| Streaming | **Do not** use SSE for upload; use multipart REST (see haystack `spring-boot-fastapi-integration-resilience.md`) |

---

### 5.2 Call 1 — Response

#### 5.2.1 Spring **public** response (normative Instant Quotation DTO)

**Endpoint:** `POST /api/v1/recommendations/from-project-spec`  
**Status:** `200 OK`  
**Contract:** This body is what the portal uses to render **YOUR RECOMMENDATIONS**. It is the **primary product response** for Instant Quotation.

##### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `quoteRef` | string | **Yes** | Display id, e.g. `QUO-8691` (Spring-generated) |
| `confidenceScore` | number (0–1) | **Yes** | Overall AI match confidence (e.g. `0.91` → 91%) |
| `days` | number | **Yes** | Rental duration in days for the quote window |
| `estimatedTotal` | number | **Yes** | Sum of line totals (SGD), e.g. `39700` |
| `specSummary` | string | **Yes** | Short project-spec summary for the UI strip |
| `rationale` | string | **Yes** | Bundle-level agent explanation |
| `items` | array | **Yes** | Ranked recommendation cards (may be empty only if no match + documented policy) |

##### `items[]` fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rankOrder` | number | **Yes** | 1-based rank (`#1`, `#2`, …) |
| `matchScore` | number (0–1) | **Yes** | Per-item match (e.g. `0.95` → 95% Match) |
| `reason` | string | **Yes** | Why this machine was selected |
| `lineTotal` | number | **Yes** | Line price for the rental window (SGD) |
| `quantity` | number | **Yes** | Portal shows read-only Qty; use `1` per card |
| `equipment` | object | **Yes** | Nested fleet card for list + detail modal |

##### `items[].equipment` fields (minimum for Instant Quotation UI)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | **Yes** | Asset / equipment id |
| `name` | string | **Yes** | Display name |
| `category` | string | **Yes** | e.g. Boom Lift |
| `baseDailyRate` | number | **Yes** | Base daily rate (SGD) |
| `weekly` | number | **Yes** | Weekly rate (SGD) |
| `capacity` | number | **Yes** | Capacity (t) |
| `purchaseYear` | number | **Yes** | Model year |
| `location` | string | **Yes** | Depot / location label |
| `available` | boolean | **Yes** | Availability flag |
| `img` | string | **Yes** | Image key (e.g. Unsplash photo id) |
| `desc` | string | **Yes** | Description |
| `tags` | string[] | **Yes** | Feature tags (may be `[]`) |

Optional extras allowed but **not required** by this screen: `minDailyRate`, `maxDailyRate`, `platformHeight`, `rating`, `reviews`, `utilization`, `revenue`, `hoursThisMonth`, `idealFor`.

##### Canonical example (product)

```json
{
  "quoteRef": "QUO-8691",
  "confidenceScore": 0.91,
  "days": 21,
  "estimatedTotal": 39700,
  "specSummary": "6-storey building · 8T load · 18m reach · 3 weeks",
  "rationale": "This bundle was chosen to cover all phases of your 21-day project...",
  "items": [
    {
      "rankOrder": 1,
      "matchScore": 0.95,
      "reason": "135ft reach covers the elevation requirement; 4WD suits uneven site terrain.",
      "lineTotal": 12180,
      "quantity": 1,
      "equipment": {
        "id": 1,
        "name": "JLG 1350SJP Telescopic Boom",
        "category": "Boom Lift",
        "baseDailyRate": 580,
        "weekly": 2600,
        "capacity": 1,
        "purchaseYear": 2023,
        "location": "Jurong Port",
        "available": true,
        "img": "photo-1780054984720-20ccf265317f",
        "desc": "Telescopic boom lift for reaching elevated work areas...",
        "tags": ["135ft Reach", "4WD"]
      }
    }
  ]
}
```

##### Portal UI binding

| UI element | Response field |
|------------|----------------|
| `Instant Quotation · QUO-8691` | `quoteRef` |
| Confidence ring / “91% AI Match Confidence” | `confidenceScore` |
| Your Project Spec strip | `specSummary` |
| Rank badge `#1` | `items[].rankOrder` |
| Match badge `95% Match` | `items[].matchScore` |
| Name / category / image | `items[].equipment.*` |
| Why text | `items[].reason` |
| Line price `S$…` | `items[].lineTotal` |
| Qty | `items[].quantity` |
| Estimated total | `estimatedTotal` (or recompute from selected items) |
| Agent rationale block | `rationale` + `days` |

**Portal after Call 1:** render `QuoteResultScreen` directly from this body. No second public call is required for Instant Quotation.

Optional non-breaking extensions Spring **may** add later (not required by UI): `ingestId`, `recommendationId`, `startDate`, `endDate`, `status`, `warnings[]`.

#### 5.2.2 How Spring builds the public response (internal saga)

```text
Portal POST from-project-spec
        │
        ▼
Spring
  1. Validate request (text and/or file, dates)
  2. POST Haystack internal submitprojectspecification  → ingest_id, kg_*
  3. POST Haystack internal getassetrecommendations
        → ranked assets / match scores / prices / reasons (product target)
  4. For each asset_id: load Asset / equipment → nested equipment object
  5. Compute quoteRef, confidenceScore (e.g. mean of matchScore),
     days, estimatedTotal, specSummary, rationale
  6. Optional: persist AIRecommendation + RecommendationItem
  7. Return Instant Quotation DTO (§5.2.1)
```

| Layer | Path | Role |
|-------|------|------|
| Spring **public** | `POST /api/v1/recommendations/from-project-spec` | Browser entry; Instant Quotation DTO |
| Haystack **internal** A | `POST /internal/v1/recommendations/submitprojectspecification` | Index + KG |
| Haystack **internal** B | `POST /internal/v1/recommendations/project-knowledge/getassetrecommendations` | Asset ranks / scores / pricing input |
| Spring Asset SoT | DB / equipment API | Nested `equipment` enrichment |

There is **no** Haystack public twin of Call 1.

#### 5.2.3 Haystack **internal** ingest body (not portal-facing)

Returned only on Spring → Haystack `submitprojectspecification`. Schema may appear as `IngestFromProjectSpecResponse` in Haystack code. **Do not** use this as the Spring public Instant Quotation response.

| Field | Type | Description |
|-------|------|-------------|
| `ingest_id` | string | Correlation key for subsequent internal get-assets / optional Q&A |
| `user_id` | string | Echo |
| `user_name` | string \| null | Echo |
| `data_kind` | `"structured"` \| `"unstructured"` \| `"mixed"` | Aggregate classification |
| `mime_types_seen` | string[] | MIME types observed |
| `filenames` | string[] | Uploaded file names |
| `structured_count` / `unstructured_count` | int ≥ 0 | Source counts |
| `document_count` / `chunk_count` / `documents_written` | int ≥ 0 | Indexing counts |
| `documents` | preview[] | Truncated chunk previews |
| `kg_built` | boolean | True on success (KG mandatory) |
| `kg_node_count` / `kg_relationship_count` | int \| null | |
| `kg_artifact_path` | string \| null | For session reload |
| `kg_transform_applied` | boolean | |
| `warnings` | string[] | Non-fatal warnings |

**What Haystack internal ingest does *not* return:** Instant Quotation fields (`quoteRef`, `confidenceScore`, nested `equipment` cards, etc.). Spring owns those for the public DTO.

---

### 5.3 Call 2 — Request (project knowledge / as-built Q&A)

Logical body shared across hops (Haystack schema name may be `ProjectKnowledgeQueryRequest`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | **Yes** | Same `user_id` used at Call 1 |
| `ingest_id` | string | **Yes** | `ingest_id` from Call 1 |
| `query` | string | **Yes** | Natural-language question (`min_length=1`) |
| `top_k` | int \| null | No | Retrieval depth override (1–50) |
| `kg_artifact_path` | string \| null | No | Reload KG-1 if process-local session lost; vector store still empty until re-ingest |

**Example — same logical body on both hops:**

- Portal → Spring: `POST /api/v1/recommendations/project-knowledge/query`
- Spring → Haystack: `POST /internal/v1/recommendations/project-knowledge/getassetrecommendations` (**internal only**)

```json
{
  "user_id": "1",
  "ingest_id": "ing_a1b2c3d4e5f6",
  "query": "What elevation reach, ground-prep, and indoor access constraints are stated in my project specification?",
  "top_k": 5,
  "kg_artifact_path": null
}
```

**Portal Instant Quotation note:** the current UI does **not** expose a free-form Q&A step. For “Generate Instant Quote →” the portal should call **only** Spring public Call 1 (`from-project-spec`) and render the Instant Quotation DTO. Public Call 2 is optional chatbot/refine only.

---

### 5.4 Call 2 — Response (as-built Q&A)

Returned on Haystack **internal** `getassetrecommendations` and mapped by Spring to public `project-knowledge/query`. Schema name in Haystack may be `ProjectKnowledgeQueryResponse`.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | Echo |
| `ingest_id` | string | Echo |
| `query` | string | Echo |
| `answer` | string | Synthesized markdown/plain answer (**no fleet inventory invention**) |
| `sources_used` | string[] | e.g. tools/agents used |
| `research_hits` | `ProjectKnowledgeHit[]` | Vector research hits |
| `graph_hits` | `ProjectKnowledgeHit[]` | KG-1 hits |
| `tool_traces` | `ProjectKnowledgeToolTrace[]` | Observability |
| `research_notes` | string \| null | |
| `graph_notes` | string \| null | |

**`ProjectKnowledgeHit`:**

| Field | Type |
|-------|------|
| `content` | string |
| `score` | float \| null |
| `meta` | object |

**`ProjectKnowledgeToolTrace`:**

| Field | Type |
|-------|------|
| `agent` | string |
| `tool` | string |
| `query` | string |
| `hit_count` | int |

**Example:**

```json
{
  "user_id": "1",
  "ingest_id": "ing_a1b2c3d4e5f6",
  "query": "What elevation reach and ground-prep constraints are in my project specification?",
  "answer": "Based on the project specification, the work includes foundation/site preparation and elevated facade access over approximately three weeks at Jurong Port. Indoor fit-out access is required prior to handover. Exact platform height and tonnage figures were not stated as numeric requirements in the indexed text.",
  "sources_used": ["project_vector_search", "project_kg_query"],
  "research_hits": [
    {
      "content": "Commercial foundation project requiring excavation and elevated facade access…",
      "score": 0.82,
      "meta": { "chunk_id": "0" }
    }
  ],
  "graph_hits": [],
  "tool_traces": [
    {
      "agent": "research_agent",
      "tool": "project_vector_search",
      "query": "elevation reach ground-prep constraints",
      "hit_count": 1
    }
  ],
  "research_notes": null,
  "graph_notes": null
}
```

#### 5.4.1 Call 2 public vs Instant Quotation

| Instant Quotation field | On public Call 2 Q&A response? | On public Call 1 Instant Quotation DTO? |
|-------------------------|--------------------------------|----------------------------------------|
| `items[].equipment` | **No** (Q&A body) | **Yes** |
| `matchScore` / `rankOrder` | **No** | **Yes** |
| `lineTotal` | **No** | **Yes** |
| `confidenceScore` | **No** | **Yes** |
| `quoteRef` | **No** | **Yes** |

Public Call 2 remains optional Q&A. Instant Quotation cards come only from **Call 1 public** response. When Spring uses Haystack internal `getassetrecommendations` **inside Call 1**, that internal response must supply (or Spring must derive) asset ranks/scores/prices — a free-text `answer` alone is not enough for `items[]`.

#### 5.4.2 Spring public response (recommended for Call 2 as-built)

Pass-through is fine:

```json
{
  "user_id": "1",
  "ingest_id": "ing_a1b2c3d4e5f6",
  "query": "…",
  "answer": "…",
  "sources_used": ["project_vector_search", "project_kg_query"],
  "research_hits": [],
  "graph_hits": [],
  "tool_traces": [],
  "research_notes": null,
  "graph_notes": null
}
```

---

### 5.5 Haystack internal asset payload → Instant Quotation DTO (mapping)

Instant Quotation for the portal is **§5.2.1** on Call 1 public. This section describes **internal** shapes Spring may consume when assembling that DTO (still **no** Haystack public URL).

#### 5.5.1 Internal get-assets request (inside Spring Call 1 saga)

Spring → Haystack: `POST /internal/v1/recommendations/project-knowledge/getassetrecommendations`

Illustrative body (product may refine):

```json
{
  "user_id": "1",
  "ingest_id": "ing_a1b2c3d4e5f6",
  "start_date": "2026-09-01",
  "end_date": "2026-09-21",
  "options": {
    "include_pricing": true
  }
}
```

#### 5.5.2 Example Haystack-oriented recommend shape (input to Spring mapping)

Useful if Haystack returns structured recommend data (schema names may match `RecommendFromProjectSpecResponse` in code):

| Field | Type |
|-------|------|
| `recommendation_id` | string |
| `start_date` | date \| null |
| `end_date` | date \| null |
| `results_by_need` | `NeedResult[]` |

**`NeedResult`:**

| Field | Type |
|-------|------|
| `need_id` | string |
| `item` | `RecommendationItem` \| **null** (exactly one or none — not top-N list) |
| `warnings` | string[] |

**Haystack `RecommendationItem` (no `quantity` field):**

| Field | Type |
|-------|------|
| `equipment_type` | string \| null |
| `asset_id` | string \| null |
| `rank` | int \| null |
| `rationale` | string \| null |
| `pricing` | `PricingPayload` \| null |
| `availability` | `"available"` \| `"unavailable"` \| `"unknown"` \| string |

**`PricingPayload`:**

| Field | Type | Notes |
|-------|------|-------|
| `daily_rate` | float \| null | For requested duration window |
| `total_price` | float \| null | `daily_rate × duration_days` |
| `currency` | string | default `SGD` |
| `deposit_rate` | float | default `0.30` |
| `model_version` | string \| null | |
| `explanation` | string \| null | |

**Example:**

```json
{
  "recommendation_id": "rec_9f3a2b1c",
  "start_date": "2026-09-01",
  "end_date": "2026-09-21",
  "results_by_need": [
    {
      "need_id": "need_elevated_access",
      "item": {
        "equipment_type": "Boom Lift",
        "asset_id": "1",
        "rank": 1,
        "rationale": "135ft reach covers the elevation requirement; 4WD suits uneven site terrain.",
        "pricing": {
          "daily_rate": 580.0,
          "total_price": 12180.0,
          "currency": "SGD",
          "deposit_rate": 0.3,
          "model_version": "xgb-pricing-v0",
          "explanation": "Predicted for 21-day window"
        },
        "availability": "available"
      },
      "warnings": []
    },
    {
      "need_id": "need_foundation",
      "item": {
        "equipment_type": "Excavator",
        "asset_id": "4",
        "rank": 2,
        "rationale": "Foundation prep and site clearing needed before elevated work begins.",
        "pricing": {
          "daily_rate": 890.0,
          "total_price": 18690.0,
          "currency": "SGD",
          "deposit_rate": 0.3,
          "model_version": "xgb-pricing-v0",
          "explanation": "Predicted for 21-day window"
        },
        "availability": "available"
      },
      "warnings": []
    }
  ]
}
```

#### 5.5.3 Map internal recommend → Call 1 public Instant Quotation DTO

| Instant Quotation DTO (§5.2.1) | Source |
|--------------------------------|--------|
| `quoteRef` | Spring-generated (`QUO-####`) |
| `confidenceScore` | Mean of item `matchScore`s **or** Haystack aggregate |
| `days` | From request dates or default policy (portal today uses 21) |
| `estimatedTotal` | Sum of `lineTotal` / `pricing.total_price` |
| `specSummary` | Truncate `project_text` / filenames / extracted summary |
| `rationale` | Synthesis summary / bundle explanation |
| `items[].rankOrder` | `item.rank` or list order |
| `items[].matchScore` | Haystack score **or** Spring-derived (must define) |
| `items[].reason` | `item.rationale` |
| `items[].lineTotal` | `pricing.total_price` or `baseDailyRate × days` |
| `items[].quantity` | Always `1` per card (unit-need expansion) |
| `items[].equipment` | Spring Asset join on `asset_id` → §5.2.1 equipment fields |

**Normative portal response remains §5.2.1** (not a separate public Call 3).

---

## 6. Field mapping matrices

### 6.1 Instant Quotation UI ← **Call 1 Spring public DTO** ← entities / Haystack

Source of truth for the portal: **`POST /api/v1/recommendations/from-project-spec` response (§5.2.1)**.

| Portal UI | Call 1 public field | Spring entity | Haystack / internal source |
|-----------|---------------------|---------------|----------------------------|
| `QUO-8691` | `quoteRef` | (Spring-generated; optional store) | — |
| Confidence % | `confidenceScore` (0–1) | `AIRecommendation.confidenceScore` | Average of item scores **or** aggregate |
| Spec strip | `specSummary` | `AIRecommendation.rawProjectPrompt` (truncated) | Call 1 request text / filenames |
| Agent blurb | `rationale` | `AIRecommendation.aiReasoningSummary` | Synthesis / get-assets summary |
| Rank `#n` | `items[].rankOrder` | `RecommendationItem.rankOrder` | `item.rank` |
| Match % | `items[].matchScore` (0–1) | `RecommendationItem.matchScore` | Score or Spring-derived |
| Why line | `items[].reason` | (extend schema or summary) | `item.rationale` |
| Line price | `items[].lineTotal` | `RecommendationItem.mlPredictedPrice` | `pricing.total_price` |
| Qty | `items[].quantity` = 1 | — | One card per unit-need |
| Machine | `items[].equipment.*` | `RecommendationItem.asset` → Asset | `asset_id` + Spring join |
| Days | `days` | derived from dates | request dates or default |
| Estimated total | `estimatedTotal` | sum of lines | sum of line prices |

### 6.2 Equipment enrichment (`mock/db.json` sample)

| `equipment` field | Needed on Instant Quotation page | Spring `Asset` analogue |
|-------------------|----------------------------------|-------------------------|
| `id` | Yes | `Asset.id` |
| `name` | Yes | `Asset.name` |
| `category` | Yes | `Asset.category` → name |
| `baseDailyRate` | Yes (modal + fallback price) | `baseDailyRate` |
| `weekly` | Yes (modal) | (may be derived; portal has field) |
| `capacity` | Yes | `capacity` |
| `purchaseYear` | Yes | `purchaseYear` |
| `location` | Yes | `location` |
| `available` | Yes | booking/availability service |
| `img` | Yes | `AssetImage` / mock id |
| `desc` | Yes | `description` |
| `tags` | Yes | optional extension |
| `idealFor` | Matching only (client) | optional |

### 6.3 Haystack internal ingest fields — portal needs?

| Haystack internal field | Portal Instant Quotation needs it? |
|-------------------------|-------------------------------------|
| `ingest_id` | **No** on public Call 1 body (Spring holds server-side for optional Q&A / saga) |
| Instant Quotation DTO fields | **Yes** — only via Spring public §5.2.1 |
| `kg_built` / counts / `documents[]` | Optional debug only; not required for YOUR RECOMMENDATIONS |
| `kg_artifact_path` | Spring-only for session reload |

---

## 7. Error contracts

Recommend shared error JSON on Spring public APIs (mirror Haystack / Spring existing style):

```json
{
  "timestamp": "2026-08-11T12:00:00+08:00",
  "status": 400,
  "error": "Bad Request",
  "message": "project_text must not be empty",
  "path": "/api/v1/recommendations/from-project-spec"
}
```

| Situation | HTTP | Notes |
|-----------|------|-------|
| Empty text and no file | 400 | Call 1 |
| Bad date window | 400 | Call 1 |
| Unsupported file type | 400 | Call 1 |
| KG build failure | 5xx / 503 | Call 1 hard-fail (Haystack policy) |
| Unknown / expired `ingest_id` | 404 | Call 2 |
| Empty query | 400 / 422 | Call 2 |
| Haystack timeout | 504 / 503 | Spring circuit breaker |
| Unauthorized portal call | 401 | Spring JWT |

---

## 8. Sequence (happy path — Instant Quotation)

Haystack column is **internal only** — not reachable from the browser.  
**One** portal POST returns the full Instant Quotation DTO.

```text
Portal (public only)           Spring (orchestrator)            Haystack (internal only)
  |                              |                                |
  |-- POST /api/v1/recommendations/from-project-spec ----------->|
  |   (multipart/JSON)           |                                |
  |                              |-- POST /internal/v1/.../       |
  |                              |   submitprojectspecification ->|
  |                              |<-- ingest body (ingest_id) ----|
  |                              |                                |
  |                              |-- POST /internal/v1/.../       |
  |                              |   getassetrecommendations ---->|
  |                              |<-- ranks / scores / pricing ---|
  |                              |                                |
  |                              |  join Asset → nested equipment |
  |                              |  build quoteRef, confidence,   |
  |                              |  days, totals, rationale       |
  |                              |  persist AIRecommendation      |
  |<-- Instant Quotation DTO ----|                                |
  |  (quoteRef, confidenceScore, |                                |
  |   days, estimatedTotal,      |                                |
  |   specSummary, rationale,    |                                |
  |   items[].equipment, …)      |                                |
  |  render YOUR RECOMMENDATIONS |                                |
```

Optional later: public Call 2 Q&A for chatbot/refine only.

---

## 9. Gaps, risks, and open questions

| # | Gap / risk | Severity | Mitigation |
|---|------------|----------|------------|
| 0 | Accidental exposure of Haystack as a public API | **High** | Network policy: Haystack only on private network; portal CORS/base URL points at Spring only |
| 1 | Internal `getassetrecommendations` may still return **Q&A** only; Call 1 public needs **assets** | **High** | Evolve internal body **or** Spring ranks fleet + project context until Haystack supplies assets |
| 2 | Call 1 public is long-running (ingest + get-assets + enrich) | Medium | Timeouts, analysing UI, optional 202+job later |
| 3 | Portal recommendations screen is client-mock; no API client yet | Medium | Bind `QuoteResultScreen` to §5.2.1 DTO |
| 4 | Haystack `ingest_id` session process-local | **High** | Spring holds session; sticky sessions / `kg_artifact_path`; re-ingest after restart |
| 5 | `matchScore` / `confidenceScore` may be missing from Haystack | Medium | Spring derives (document policy) |
| 6 | Multi-file portal vs single `file` part | Medium | Product: first file only / zip / multi-ingest |
| 7 | Asset id type string (Haystack) vs Long (Spring/portal) | Low | Coerce in Spring |
| 8 | Auth on Haystack | Medium | Internal-only network + service auth |
| 9 | Spring entities lack per-item rationale column | Low | Use `aiReasoningSummary` or extend schema |
| 10 | Quantity: UI shows Qty 1; expand unit-needs server-side | Low | One card per unit-need |

### Open questions

1. Default rental `days` when dates omitted (portal hardcodes 21 today)?  
2. Persist every GENERATED recommendation or only on “Add to Rental Plan”?  
3. Multi-file: reject >1 file or sequential ingest?  
4. Exact internal get-assets JSON when Haystack is not yet asset-shaped?

---

## 10. Feasibility by integration slice

| Slice | Feasibility | Notes |
|-------|-------------|-------|
| Portal multipart/JSON → Spring **public** Call 1 | **GO** | Upload UX; no Haystack URL in portal |
| Spring Call 1 returns Instant Quotation DTO (§5.2.1) | **GO (product contract)** | Normative for YOUR RECOMMENDATIONS |
| Spring internal saga: ingest + get-assets + Asset enrich | **GO** | Resilience required on long request |
| Portal Instant Quotation from **one** Call 1 response | **GO** | No public Call 3 required |
| Portal Instant Quotation from public Call 2 Q&A alone | **NO-GO** | Wrong shape |
| Portal or third party calling Haystack directly | **NO-GO** | No Haystack public endpoint |
| Persist `AIRecommendation` / items | **GO** | Entities ready; needs service layer |
| Match portal equipment modal 1:1 | **GO** | Nested `equipment` in §5.2.1 |

---

## 11. Implementation phasing (recommended)

| Phase | Work | Exit criteria |
|-------|------|----------------|
| **S0** | This study; Call 1 public = Instant Quotation DTO; Haystack internal-only | Signed decision card |
| **S1** | Spring: public Call 1 returns §5.2.1 shape (stub/hardcoded items OK for contract freeze) | OpenAPI + curl match example |
| **S2** | Spring: WireClient saga — internal `submitprojectspecification` + `getassetrecommendations` + Asset enrich | Real assets in `items[]` |
| **S3** | Portal: POST `from-project-spec` on Generate Instant Quote; bind `QuoteResultScreen` to response | Remove hardcoded REC_ITEMS |
| **S4** | Optional public Call 2 Q&A for chatbot/refine | Not blocking Instant Quotation |
| **S5** | Persist AIRecommendation on generate/accept | DB rows match UI |
| **S6** | Resilience: timeouts, circuit breaker, correlation ids, optional 202 jobs | Stable under KG/LLM latency |

---

## 12. Contract checklist (definition of “clear and well defined”)

Use this when reviewing OpenAPI / Spring DTOs / portal types:

### Call 1 public (`from-project-spec`) — Instant Quotation

- [ ] Request: JSON fields table + multipart parts table  
- [ ] Response **must** include: `quoteRef`, `confidenceScore`, `days`, `estimatedTotal`, `specSummary`, `rationale`, `items[]`  
- [ ] Each item: `rankOrder`, `matchScore`, `reason`, `lineTotal`, `quantity`, nested `equipment`  
- [ ] `equipment` min fields: `id`, `name`, `category`, `baseDailyRate`, `weekly`, `capacity`, `purchaseYear`, `location`, `available`, `img`, `desc`, `tags`  
- [ ] Errors: empty input, bad dates, bad MIME, KG/get-assets failure  
- [ ] Explicit: public body is Instant Quotation DTO — **not** raw Haystack ingest  

### Call 1 internal saga

- [ ] `submitprojectspecification` → `ingest_id`  
- [ ] `getassetrecommendations` → ranks/scores/prices (or Spring fallback)  
- [ ] Asset join → nested `equipment`  
- [ ] Mapping to `AIRecommendation` / `RecommendationItem`  

### Call 2 public (optional Q&A)

- [ ] Request: `user_id`, `ingest_id`, `query`, optional `top_k`, `kg_artifact_path`  
- [ ] Response: `answer` + hits + traces typed  
- [ ] Explicit: **not** Instant Quotation asset list  


---

## 13. One-page decision card

| Decision | Recommendation |
|----------|----------------|
| Create portal `Feasibility_Study` docs for Instant Quotation integration? | **Yes (done in this document)** |
| Portal → Spring public only; Haystack internal only? | **GO** |
| Haystack public / browser-facing endpoint? | **NO** |
| **`from-project-spec` returns Instant Quotation DTO (§5.2.1)?** | **YES — product contract** |
| Single portal POST for YOUR RECOMMENDATIONS? | **GO** |
| Spring Call 1 orchestrates internal ingest + get-assets + Asset enrich? | **GO** |
| Separate public Call 3 for Instant Quotation? | **NO** — obsolete for happy path |
| Public Call 2 required for Instant Quotation? | **NO** — optional Q&A only |
| Instant Quotation DTO with nested equipment? | **GO** |
| Derive `matchScore` / `confidenceScore` if Haystack omits? | **CONDITIONAL — document policy** |
| Persist using existing Spring entities? | **GO** when items returned |
| Next engineering step | Implement Spring Call 1 public DTO + internal saga; portal binds QuoteResultScreen |

---

## 14. Source references

| Source | Location |
|--------|----------|
| Portal Instant Quotation UI | `src/features/browse/CustomerOnboarding.tsx` |
| Portal equipment type | `src/app/types.ts` → `Equipment` |
| Portal mock fleet | `mock/db.json` → `equipment` |
| Spring public routes (product) | `POST /api/v1/recommendations/*` — only portal-facing recommendation API |
| Haystack internal routes (product) | `POST /internal/v1/recommendations/submitprojectspecification`, `…/getassetrecommendations` — **no public twin** |
| Haystack ingest / Q&A / recommend field schemas | haystack `app/schemas/indexing.py`, `project_knowledge.py`, `recommendations.py` (payload shapes; not public URLs) |
| Haystack Call 1 summary study | haystack `Feasibility_Study/call1-ingest-response-project-summary.md` |
| Haystack Spring resilience study | haystack `Feasibility_Study/spring-boot-fastapi-integration-resilience.md` |
| Haystack synthesis / assets study | haystack `Feasibility_Study/multi-agent-synthesis-recommend-output.md` |
| Spring entities | `AIRecommendation.java`, `RecommendationItem.java`, `Asset.java` |
| Spring entity SDD | `specification/SPEC-entity-repository.md` §5.12–5.13 |

---

## 15. Document control

| Version | Date | Notes |
|---------|------|--------|
| **1.0.0** | 2026-08-11 | Initial portal feasibility study: Call 1/2 contracts, Call 3 Instant Quotation DTO, mapping to UI + `db.json` + Spring entities |
| **1.1.0** | 2026-08-11 | **No Haystack public endpoint**: portal → Spring `/api/v1/*` only; Spring → Haystack `/internal/v1/*` only |
| **1.2.0** | 2026-08-11 | **Call 1 public returns Instant Quotation DTO** (`quoteRef`, `confidenceScore`, `days`, `estimatedTotal`, `specSummary`, `rationale`, `items[]` + nested `equipment`); Spring orchestrates internal ingest + get-assets; public Call 3 happy path removed |
