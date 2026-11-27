# Persistent hardware knowledge prototype

Uses built-in node:sqlite (Node 22.19+, consistent with REA's supported runtime). Keep the database and input JSON outside the public checkout.

The save input is a JSON object with profile, tree, catalog, config (optional flat symbol map), and firmware fields from prior stages. Extract the profile from the ADB import envelope. Reports join exact firmware names, preserve source evidence references, and explicitly mark target association as caller asserted. No automatic inference across devices.

```sh
node experiments/mobile-linux/knowledge-cli.mjs save /private/mobile.db inputs.json
node experiments/mobile-linux/knowledge-cli.mjs list /private/mobile.db "Device model"
node experiments/mobile-linux/knowledge-cli.mjs get /private/mobile.db REPORT_ID
node experiments/mobile-linux/knowledge-cli.mjs record-runtime /private/mobile.db REPORT_ID observation.json
node experiments/mobile-linux/knowledge-cli.mjs runtime /private/mobile.db REPORT_ID
node --test experiments/mobile-linux/*.test.mjs
```

Runtime observation JSON contains component, outcome (pass/fail/inconclusive), evidence_sha256 and note. These are caller-submitted claims, not independently verified hardware results. They never overwrite the static report or establish bootability. Report IDs hash stored serialized bytes, not canonical semantic equivalence. Runtime listing is capped at 1000 rows; pagination and schema migrations are future work. Database writes are local only. Use a trusted local path, not an untrusted SQLite file. No device mutation, firmware download or execution.

Next: native authenticated REA evidence integration, test execution and a verified device workflow.
