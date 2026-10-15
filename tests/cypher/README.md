# Cypher verification

The local Spring Boot service must be running. `CYPHER_BASE` defaults to
`http://127.0.0.1:18080`. Run with Node and Playwright available:

```powershell
node --test tests/cypher/live.test.cjs tests/cypher/ui.test.cjs
```

Live tests execute all nine examples against the `neo4j` database, verify
TC-01/03/04/05 and example 06, and exercise parameterized queries,
safe procedures, rejected writes, syntax errors and output limits.
Write statements are only submitted to the endpoint to verify rejection;
the server runs EXPLAIN first and never executes them.

This suite does not replace that assertion or relabel it as passed.
UI tests cover editable examples, explicit submission, CSV escaping,
loading/cancellation, stale-result clearing, map isolation, builder mode,
and 1440/390/320px layouts. `artifacts/` is ignored local output.
