# Source-built boot validation

Reference boot succeeded on GitHub Actions run 46122960041 (commit da899ab).
The report recorded Debian vmlinuz-6.1.0-57-arm64 and guest_marker_observed.
This is reference evidence, not source compilation.

The source-boot orchestrator chains the existing kernel executor, BusyBox
compiler, initramfs generator and QEMU runner. It records stage progress
and failure evidence. Local usage requires absolute paths, reviewed sources,
matching archive digests, a restricted Linux VM and build prerequisites.

The source-built workflow is manual and restricted to the development
branch. Supply independently reviewed full Git revisions and expected
archive hashes for torvalds/linux and mirror/busybox. No placeholder pins
or automatically trusted downloads. The workflow checks both hashes before
extracting into fresh directories. Archive extraction and compilation of
reviewed source are not a sandbox; use trusted revisions only. Hosted
runner dependencies are not fully pinned. The workflow is not automatically
started by this commit; GitHub may require the workflow file on the default
branch before dispatch is available. If so, run the orchestrator locally
rather than merging unverified changes solely to enable dispatch.

No source-built boot result or physical deployment claim until real evidence
is captured. The workflow retains reports and logs, not distributable binaries.
