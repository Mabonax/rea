# Mobile Systems Engineering — Phase 0

Goal: evidence-driven GNU/Linux port planning for owned or explicitly authorised Android devices. Android already uses Linux; the goal is a conventional Linux userspace with device-specific hardware support. Apple hardware is deferred.

## Architecture

Existing REA evidence -> validated mobile profile -> deterministic gap analysis -> reviewed port plan -> isolated build/test (future).

Reuse src/application/adb, src/application/firmware, src/domain, src/contracts, src/cli and src/server. Keep provider execution separate from pure planning. Register future CLI/MCP tools through shared contracts and regenerate catalogs, not hand-edited generated outputs.

The experimental implementation under experiments/mobile-linux is deliberately standalone, dependency-free Node ESM. It reads a small local JSON profile and emits a planning report; it does not contact a device, run a shell, download, flash, unlock or build an OS. Claims in a profile are caller-supplied, not independently verified by the planner.

Run from repository root:

```sh
node --test experiments/mobile-linux/planner.test.mjs
node experiments/mobile-linux/plan.mjs experiments/mobile-linux/example.json
```

## Milestones and acceptance

1. Profile and planner: validate schema, preserve evidence references, report unknowns, refuse unsupported targets. Synthetic fixtures only.
2. REA evidence ingestion: map explicit device identity, kernel version/config, device tree, modules, firmware inventory, vendor interfaces and boot policy. Preserve producer evidence IDs and hashes, redact serials and personal data before publishing.
3. Offline boot and device tree parsers: use public fixtures and bounded reads; verify offsets, sizes, formats, hashes and malformed input behavior.
4. Source matching: identify exact vendor kernel release, configs, DTB/DTBO, modules and licence terms. Compare mainline support and downstream alternatives. Unknown is not unsupported.
5. ARM64 QEMU: reproducible pinned kernel/rootfs build, serial console, boot test and artifact manifests. No physical device writes.
6. Known Android target: choose a documented unlockable phone with existing Linux support; verify exact model, stock recovery image and recovery procedure before any separately authorised hardware experiment.
7. Native hardware enablement: test display/touch, storage, USB, Wi-Fi, audio, power, modem and camera separately. Publish a compatibility matrix with evidence and limitations.

No bypass of secure boot or access controls, no extraction of personal data, no automatic flashing, no redistribution of proprietary firmware without permission. Treat downloaded artifacts as untrusted data, never execute extracted binaries. Device mutations require a separate reviewed workflow and explicit approval. Never claim bootability based on a static profile.

See AUDIT.md for baseline findings.
