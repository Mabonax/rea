# Native integration checkpoint

The initial native application service is src/application/adb/MobileEvidence.ts.
It uses REA parseEvidence to validate semantic identifiers and existing ADB
service execution for three fixed read-only operations. It checks same-device
serial consistency, provider identity and expected result shapes. It does
not independently attest the hardware or the provenance of a fabricated but
self-consistent evidence envelope. Serial is omitted from the projection.

The application service is intentionally not registered as a public MCP or CLI
tool yet. Its output is not the experimental planner profile schema, and the
SQLite store is not wired into this service. Future work must add typed error
mapping, cancellation coverage, native profile projection, public tool
contracts, generated catalogs and lifecycle integration.

An isolated GitHub Actions job runs the dependency-free experimental suite
on Node 24. Native TypeScript tests still require the normal repository
dependency and test preparation process:

```sh
npm ci
npm run typecheck
npm run test:local -- src/application/adb/MobileEvidence.test.ts
node --test experiments/mobile-linux/*.test.mjs
```

Do not interpret workflow creation as a passing test result. No device writes,
flashing, downloads or kernel builds are introduced in this checkpoint.
