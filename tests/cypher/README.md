# Cypher verification

The local Spring Boot service must be running. `CYPHER_BASE` defaults to
`http://127.0.0.1:18080`. Run with Node and Playwright available:

```powershell
node --test tests/cypher/examples.test.cjs
node --test tests/cypher/live.test.cjs tests/cypher/ui.test.cjs
```

`examples.test.cjs` runs without a backend and checks the nine queries against
`fixtures/core-queries.txt`, exact result columns/sorting, descriptions and editor
selection/editing/explicit submission. Node needs Playwright and a Chromium runtime.

Live tests execute all nine examples against the `neo4j` database, verify
the exact user-requested RETURN column order, and exercise parameterized queries,
safe procedures, rejected writes, syntax errors and output limits.
Write statements are only submitted to the endpoint to verify rejection;
the server runs EXPLAIN first and never executes them.

The examples intentionally do not add district-code, threshold or diagnostic columns.
UI tests cover editable examples, explicit submission, CSV escaping,
loading/cancellation, stale-result clearing, map isolation, builder mode,
and 1440/390/320px layouts. `artifacts/` is ignored local output.

To execute only the nine read-only examples against an existing backend:

```powershell
node --test --test-name-pattern="nine user core" tests/cypher/live.test.cjs
```
