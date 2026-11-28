# Minimal ARM64 userspace

The generator takes an explicitly supplied, trusted ARM64 BusyBox executable
and expected SHA-256. It checks ELF class, byte order, architecture, program
header bounds, executable entry and absence of PT_INTERP. This does not
establish BusyBox identity or prove static linkage, applet availability or
runtime behaviour. Compile a reviewed BusyBox source with static linking
and enable sh, mount, echo and uname applets; compilation itself is not yet
automated. Verify the executable separately.

```sh
node experiments/mobile-linux/initramfs-cli.mjs /absolute/busybox EXPECTED_SHA256 /absolute/output-root
node --test experiments/mobile-linux/*.test.mjs
```

The generator writes a deterministic gzip-compressed newc CPIO archive and
manifest into a unique local output directory. No root privileges, host
device nodes, archive extraction, binary execution or physical device access
are required. The init script mounts devtmpfs, proc, sysfs and tmpfs, checks
uname -m, emits REA_MOBILE_BOOT_OK and starts a shell. The shell is root
inside the intended isolated guest, with no production security policy.
Do not deploy this prototype on a network or physical device.

The tests use synthetic ELF fixtures, not actual BusyBox. The next step
is BusyBox build orchestration and bounded QEMU boot execution with actual
kernel and initramfs artifacts, no networking and verified console output.
