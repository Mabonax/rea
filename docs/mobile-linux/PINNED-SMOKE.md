# Pinned source smoke build

This branch-only push-triggered CI lane selects Linux v6.12 commit
adc218676eef25575469234709c2d87185ca223a and BusyBox 1_36_1 commit
1a64f6a20aaf6ea4dbba68bbfa8cc1ab7e5c57c4. GitHub tag lookup resolved
these object identities; upstream signatures were not independently verified.
The Linux tag API reported verification false. These older release baselines
are for an isolated compatibility trial, not production deployment.

CI fetches exact Git commits over HTTPS, checks FETCH_HEAD and Git object
integrity, generates local source archives and extracts those same archives
before invoking the source-boot orchestrator. Archive hashes are locally
derived, not independently published reference hashes. This is a separate
trust model from the manual independently hash-pinned workflow, which remains
available. Host packages are not immutably pinned.

The push trigger avoids requiring workflow dispatch on the default branch.
Only build evidence is uploaded. Inspect the resulting job and report before
claiming a compiled boot. Do not merge merely to run CI. No guest networking
or physical device interaction is intended.
