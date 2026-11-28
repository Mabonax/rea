# Virtual boot execution

Linux host with trusted reviewed source, ARM64 cross compiler, make and QEMU
system AArch64 installed. Use a disposable restricted VM, with disk quotas.
No automatic installation or network access is requested by the runner.
The compilation tools and QEMU themselves are not sandboxed.

Run the existing kernel executor, then:

```sh
node experiments/mobile-linux/virtual-boot-cli.mjs busybox --execute inputs.json /absolute/busybox-source /absolute/busybox-archive /absolute/output
node experiments/mobile-linux/initramfs-cli.mjs /absolute/busybox EXPECTED_SHA256 /absolute/output
node experiments/mobile-linux/virtual-boot-cli.mjs qemu --execute /absolute/Image KERNEL_SHA256 /absolute/initramfs.cpio.gz INITRAMFS_SHA256 /absolute/output
```

Replace all placeholders with actual artifacts and hashes. The BusyBox archive
is verified separately from the caller-selected source directory; no cryptographic
binding is claimed. BusyBox make targets and configuration options must be
validated against the selected revision. The QEMU runner copies and verifies
both artifacts, uses TCG, disables networking and the monitor, captures serial
stdout up to a combined 4 MiB process-output budget, and stops at a complete
success-marker line or failure/timeout. Stderr is counted but not persisted.
A guest marker is evidence of reported guest progress, not independent hardware
attestation. No physical deployment or interactive guest shell is enabled.

Synthetic unit tests do not execute a real build or boot. Verify an actual
kernel and BusyBox build and capture the boot report before calling v0.1 bootable.
