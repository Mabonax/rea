# BusyBox 1.36.1 compatibility checkpoint

The pinned source smoke run 46123514145 failed during compilation. Local
Codex diagnosis of its uploaded diagnostic archive reported that the kernel
compiled and BusyBox tc failed because legacy CBQ definitions were absent
from the cross-toolchain headers. TC is not required for the initial initramfs.
Disable CONFIG_TC before configuration resolution and check that it remains
disabled afterwards, while preserving static linking and the required init
applets. The regression test covers enabled, disabled and missing TC input
and rejects conflicting effective declarations.

The upstream source revisions are unchanged. This is a scoped prototype
compatibility fix, not a permanent networking policy. For later traffic
management, evaluate current iproute2 or a maintained BusyBox revision.

The push-triggered source smoke workflow will test the correction. A source
boot must still be observed before packaging v0.1.
