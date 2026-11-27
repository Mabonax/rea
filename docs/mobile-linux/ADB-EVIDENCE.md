# Read-only Android evidence ingestion

Use existing REA CLI or MCP tools on an owned or explicitly authorised device.
Select one serial explicitly from the device listing. No root or bootloader
unlock is required. The ADB client may start its local server.

Example (shell, with a locally configured REA installation):

```sh
rea list-adb-devices
rea inspect-adb-device SERIAL --json > identity.json
rea list-adb-features SERIAL --json > features.json
rea inspect-adb-display SERIAL --json > display.json
node experiments/mobile-linux/import-adb.mjs identity.json features.json display.json
node --test experiments/mobile-linux/*.test.mjs
```

Replace SERIAL with the selected device identifier. Keep evidence files local;
they contain device identifiers and potentially identifying build metadata.
The importer expects individual REA Evidence envelopes, not arbitrary CLI
wrappers. If the installed CLI emits a wrapper, select the evidence object
before import. Do not commit the captures.

The adapter checks operation names, envelope shape, observed confidence,
consistent explicit serial, and bounds on inputs. It preserves evidence IDs
but does not authenticate their canonical hashes. It maps Android declarations
to observations, not Linux driver compatibility. ABI is a userspace
declaration, not kernel architecture. No raw evidence or explicit device serial
is emitted; model and evidence IDs still require publication review.

No new MCP tools have been registered yet. Next: use the native TypeScript
Evidence parser and existing ADB service to authenticate and compose
observations; add dedicated bounded read-only kernel and module operations.
