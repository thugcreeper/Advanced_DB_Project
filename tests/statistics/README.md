# Statistics tests (current Neo4j schema)

All production statistics and snapshot queries use the rebuilt `neo4j` schema.
TC-01 through TC-06 and TC-08 are retained; there is no TC-07 test.

From `backend`, with Java 17:

```powershell
.\mvnw.cmd '-Dmaven.repo.local=.maven-cache/repository' -o test
```

Default tests use controlled repository doubles, not Neo4j. Enable read-only
database snapshots explicitly:

```powershell
$env:NEO4J_SNAPSHOT_TESTS='true'
.\mvnw.cmd '-Dmaven.repo.local=.maven-cache/repository' -o test
Remove-Item Env:NEO4J_SNAPSHOT_TESTS
```

Credentials come from environment variables or backend `.env`. Database is always
`neo4j`; missing credentials cause an explicit skip. Opted-in connection failures
are errors. Offline Maven requires cached dependencies. Never commit credentials.

Browser tests from the repository root, with Node.js and Playwright:

```powershell
node --test tests/statistics/frontend.test.cjs
node --test tests/statistics/live.test.cjs
```

Use `NODE_PATH` for an external Playwright package and optionally
`PLAYWRIGHT_EXECUTABLE` for installed Chromium. Live tests require the running
backend and Neo4j. `STATISTICS_BASE` defaults to `http://127.0.0.1:18081`.

TC-08 keeps the user's expected Western doctor numbers unchanged. The current
database differs; that snapshot must remain red until the expectation/data
discrepancy is explicitly resolved. A separate test verifies arithmetic for all
three doctor categories without using the disputed fixed expected values.

Eight module tests cover results, numeric sorting, missing values and CSV safety.
Six unused client-side filter tests and `pages/query/filters.js` were removed;
current server-side filtering is covered by API and live-page tests instead.
Two isolated relationship-fixture TODOs remain pending and are not passes.
No test writes fixtures into the production database.

Current report: `docs/verification/district-statistics-schema-update-2026-10-13.md`.
Older reports are historical and must not be used as current schema validation.
