# Kernel intelligence prototype

Offline read-only inspection of supplied files. No device access, privilege changes, or flashing. Use public vendor source/configuration or authorised captures.

Run from repository root:

```sh
node experiments/mobile-linux/inspect-kernel.mjs release kernel-release.txt
node experiments/mobile-linux/inspect-kernel.mjs config kernel.config
node experiments/mobile-linux/inspect-kernel.mjs modules modules.txt
node experiments/mobile-linux/inspect-kernel.mjs boot boot.img
node --test experiments/mobile-linux/*.test.mjs
```

Release input is plain uname -r output; config is uncompressed Kconfig text; modules use /proc/modules text. Missing config options are null, disabled options are n. Module used-by names are not forward dependencies. Android release tags do not prove GKI compatibility. Boot parser supports only standard Android boot v3/v4, fixed 4096 byte alignment, with no decompression or signature validation. Vendor boot, legacy headers, sparse images, DTB/DTBO and AVB require separate parsers. Input limit is 8 MiB for text and 128 MiB for boot. Output hashes identify supplied bytes, not authenticity.

Format reference: https://source.android.com/docs/core/architecture/bootloader/boot-image-header

The prototype is independent of REA's native MCP contracts and does not yet feed the hardware planner automatically. Next: validate against public source-derived fixtures and integrate authenticated evidence.
