# Source and firmware indexing

Run from the REA repository root using a stable local checkout:

```sh
node experiments/mobile-linux/index-source.mjs source /path/to/linux/drivers FULL_GIT_COMMIT > source-index.json
node experiments/mobile-linux/index-source.mjs firmware /path/to/firmware/subtree > firmware-index.json
node --test experiments/mobile-linux/*.test.mjs
```

Use the actual full Git commit instead of FULL_GIT_COMMIT. The index records caller-supplied revision, relative paths, SHA-256 of read bytes, C compatible-literal hints, simple Kbuild object rules, and Kconfig declarations/directives. It does not verify the Git revision, parse C or evaluate dependency expressions. No reviewed driver catalog is generated automatically.

Firmware inventory lists ordinary files and hashes those at most 2 MiB; larger files are marked too_large, not absent. Symlinks and special files are skipped. Neither inventory downloads or executes artifacts. Each traversal is limited to 100000 entries, 64 levels, 256 MiB read bytes, and 20000 records; large source trees must be split into subtrees. Errors fail the operation rather than returning a misleading complete index. Source file size and UTF-8 skips are reported. Source hints are capped at 100000. Do not use concurrently modified or adversarial directory trees: directory ancestry is not atomically pinned.

The next stage joins reviewed catalog requirements with firmware inventory and produces a unified device report. A matching hash does not prove licence, authenticity or hardware compatibility. Keep proprietary firmware outside the public repository.
