# Linux driver compatibility prototype

Run from repository root:

```sh
node experiments/mobile-linux/inspect-hardware.mjs dtb board.dtb > tree.json
node experiments/mobile-linux/match-drivers.mjs tree.json experiments/mobile-linux/driver-catalog.example.json
node --test experiments/mobile-linux/*.test.mjs
```

The example catalog is synthetic, not an actual Linux driver. Replace it with reviewed records from a pinned Linux or vendor source revision. Each entry contains an ID, origin, full Git revision, relative source path, source SHA-256, exact compatible strings, declared mandatory Kconfig symbols, and firmware names. The optional CONFIG.json is a flat map of CONFIG symbols to y/m/n/null (not the full kernel inspection envelope). Missing requirements remain unknown.

source-candidate.mjs exports a bounded lexical discovery helper for C compatible initializers. It deliberately does not create trusted catalog entries; reviewers must confirm active match tables, Kbuild/Kconfig, dependencies, licence and firmware declarations. The current adapter neither scans a source tree automatically nor authenticates catalog claims. No matching candidate proves runtime support; no match proves nothing about the wider Linux ecosystem. Disabled nodes remain separate. No firmware is downloaded or executed.

Next: source tree provenance and automated indexing, Kbuild/Kconfig relationship parsing, firmware inventory and cross-artifact compatibility report, then authenticated REA integration.
