# Integration verification

The one-time Java migration tool and launcher were retired after integration.
These regression checks use the existing ignored audit snapshots under
`backend/migration-local`. Snapshots and backups are never committed. On a fresh
checkout, obtain a reviewed local baseline before running snapshot-based tests;
do not run a migration merely to test the website.

```powershell
$env:INTEGRATION_BASE='http://127.0.0.1:18084'
node tests/integration/example-snapshot.cjs --before
```

Use `--before` only before migration, against the current working service.
After migration, point INTEGRATION_BASE at the integration service and run:

```powershell
node tests/integration/example-snapshot.cjs
node --test tests/integration/facilities.test.cjs tests/integration/district-ui.test.cjs
node tests/integration/verify-snapshots.cjs
```

The retired Java verifier checked all twelve integration cases, property types,
relation provenance and matching; its results remain in the verification report.
The retained Node checks compare the complete nine-example
results, every one of the 368 district memberships, type totals, department
filtering, old schema/index definitions, and real desktop/mobile map behavior.
Node is used only for regression verification and does not perform data migration.

Integration TC-08 is the actual department query. The unresolved Western-doctor
expectation in `tests/statistics/live.test.cjs` is a separate historic case and
is not changed or renamed by this suite.
