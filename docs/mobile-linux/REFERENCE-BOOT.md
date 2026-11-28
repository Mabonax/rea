# Reference ARM64 boot validation

A separate GitHub Actions lane attempts an actual QEMU boot using Debian
bookworm ARM64 distribution packages obtained via signed apt indexes. It
records package versions and hashes, generates the REA initramfs, and runs
the bounded QEMU serial marker test. No device access or guest networking.

The reference kernel is not compiled by REA. Package selection follows the
current distribution indexes, not immutable version pins, so this is a
compatibility smoke test rather than a reproducible source build. The runner
accepts only raw or gzip-compressed ARM64 Image files; other package formats
fail explicitly. Repository package availability and kernel config may
cause failure. GitHub-hosted runners are disposable but the emulator is not
a dedicated security sandbox.

Inspect the workflow logs and uploaded report; only guest_marker_observed
counts as the reference boot success condition. The next independent lane
must build pinned kernel and BusyBox sources and boot those exact artifacts.
No physical boot claim is warranted.
