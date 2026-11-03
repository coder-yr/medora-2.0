# Medora 2.0 — Dashboard Performance & Caching Policy

## 1. Principles of Real-Time Analytics
1. **Aggregations Over Entities**:
   - Dashboard endpoints must never return raw entity record dumps.
   - Aggregate via Prisma `count`, `aggregate`, and `groupBy`.
2. **Indexed Filter Columns**:
   - Queries strictly filter on indexed composite columns: `createdAt`, `branchId`, `status`, `date`.
3. **Bounded Time Windows**:
   - Time filters default to `today` or `last30Days`.
   - Custom time ranges are bounded to a maximum of 366 days to protect the operational database from unbounded table scans.

---

## 2. In-Memory Freshness & Caching Layer
- **Cache Strategy**: Lightweight in-memory TTL caching (30 to 60 seconds) for expensive multi-join aggregations (e.g. branch comparison and financial statement summaries).
- **Cache Invalidation & Isolation**:
  - Keys are explicitly scoped: `cache:dashboard:<branchId>:<role>:<period>:<rangeStart>:<rangeEnd>`.
  - Non-global branch queries can never access or poison global cache keys.
  - Active write events (e.g. shift close, invoice issuance, bed transfer) bust relevant branch cache namespaces.
- **Expected Data Freshness**:
  - Operational queues (waiting room, open shifts, pending samples): **Zero cache / Live query (< 50ms latency)**.
  - Executive financial aggregates: **30 seconds maximum staleness**.
