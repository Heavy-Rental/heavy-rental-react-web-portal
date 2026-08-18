# Feasibility studies (React web portal)

Architecture and integration studies for `heavy-rental-react-web-portal` (docs only — not runtime source of truth).

## How to read

| Document | Topic | Version |
|----------|--------|---------|
| [`instant-quotation-asset-recommendation-integration.md`](./instant-quotation-asset-recommendation-integration.md) | Instant Quotation: React → Spring `from-project-spec` returns **Instant Quotation DTO**; Haystack internal-only; Call 1 / Call 2 contracts | **1.2.0** |

## Related repositories

| System | Repo |
|--------|------|
| React web portal | this repository (`heavy-rental-react-web-portal`) |
| Spring Boot REST API | [Heavy-Rental/heavy-rental-spring-rest-api](https://github.com/Heavy-Rental/heavy-rental-spring-rest-api) |
| Haystack FastAPI | [Heavy-Rental/haystack-fast-api](https://github.com/Heavy-Rental/haystack-fast-api) |

Haystack-side feasibility studies (ingest summary, Spring resilience, multi-agent synthesis) live under  
`haystack-fast-api/Feasibility_Study/` on the `develop` branch.
