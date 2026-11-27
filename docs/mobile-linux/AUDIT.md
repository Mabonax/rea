# Mobile Linux foundation audit

Baseline: e8da7e1edd075feec0e6beedec93d5645fed8125. Scope: package metadata, source directory layout, ADB port/service/command/MCP registration, firmware port, and ADB, firmware and Android guides. Static review only; no dependency installation, full source review, CI execution or hardware verification.

| Area | Finding | Action |
| --- | --- | --- |
| Architecture | Shared application ports/services and domain contracts feed CLI and MCP | Reuse these boundaries; do not duplicate subprocess adapters |
| ADB | Fixed getprop whitelist, explicit serial, bounded subprocess capture and quoted shell operands | Add narrowly scoped read-only kernel/hardware operations through existing admission |
| ADB mutation | Existing MCP surface includes push/install/uninstall/start/stop | Mobile workflow must allowlist read-only calls, not grant entire tool family |
| Firmware | Binwalk and Unblob, 128 MiB input cap, explicit extraction, bounded resources, digest provenance | Large Android images need separately designed streaming/partition handling; do not lift limits globally |
| Android APK | JADX evidence supports framework and application inspection | Do not mistake APK inspection for kernel or driver support |
| Kernel/boot | Firmware guide explicitly excludes device-tree and bootloader semantics | Add format-aware parsers and public-source matching |
| Testing | Vitest, real-provider verification scripts and architecture guards exist | Run baseline and targeted tests before integration |
| Release | Package identity still points to upstream morluto/rea | No npm publication or upstream identity changes from this branch |

No vulnerabilities are asserted by this limited audit. Unknowns: actual provider health, CI baseline, supported hardware, bootloader policy, kernel source availability, firmware licensing and real-device behavior.

Priority: profile schema and deterministic planning; then evidence adapters, kernel/DTB/boot parsers, emulator and known-device reproduction. See README.md.
