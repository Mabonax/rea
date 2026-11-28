# ARM64 virtual Linux build planning

The first target is QEMU virt, not physical Android hardware. The planner accepts schema_version 1, target qemu-arm64-virt, kernel and busybox objects each containing revision (full 40-character Git commit) and archive_sha256, jobs (1–32), and virtio_extras (boolean). Values must refer to actual reviewed local source archives; no placeholder pins are distributed.

```sh
node experiments/mobile-linux/build-plan-cli.mjs plan inputs.json > build-plan.json
node experiments/mobile-linux/build-plan-cli.mjs check inputs.json effective.config
node --test experiments/mobile-linux/*.test.mjs
```

The generated fragment requests built-in initial boot features for ARM64, PL011 serial, ELF/script execution, gzip initramfs, virtual filesystems and virtio. Optional block and network drivers do not enable QEMU networking. Merge against the selected kernel's arm64 defconfig, run olddefconfig, then check the effective configuration; Kconfig dependencies may discard requests. A missing or modular required symbol fails the check. The plan does not evaluate all Kconfig dependencies, fetch sources, authenticate pins, install compilers, run builds, generate filesystems or start QEMU. A successful config check is not a boot test.

Next: a reviewed build executor with isolated output paths, verified archive inputs, bounded jobs, recorded compiler versions and artifact hashes; then a static BusyBox initramfs and serial-console boot verification. No flashing or device changes.
