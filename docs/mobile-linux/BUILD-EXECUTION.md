# ARM64 kernel build execution checkpoint

Linux host, trusted reviewed Linux source tree, matching local source archive and installed native build dependencies plus aarch64-linux-gnu-gcc are prerequisites. Use the build input schema from BUILD-PLAN.md. Run only after reviewing the source and host environment:

```sh
node experiments/mobile-linux/build-executor-cli.mjs --execute inputs.json /absolute/kernel-source /absolute/kernel-archive /absolute/build-output
```

Output root must already exist and be independent of the kernel source directory. The executor checks the archive SHA-256, creates a unique output directory, probes compiler and make versions, runs defconfig, merges the required fragment, resolves olddefconfig, checks effective configuration, and builds Image. Each stage has a local log; manifest records completion and artifact hashes. Compilation timeout is one hour, other stages two minutes. Jobs are restricted by the planner. The process uses fixed argv, a restricted PATH and environment, but is not sandboxed: trusted source Makefiles execute host code and can access files and network under the current account. Use a disposable restricted VM for builds, and enforce disk quotas externally; logs are not size capped. No automatic downloads, package installation, root escalation or flashing.

The archive digest is checked, but the source tree is separately supplied and not cryptographically bound to it. The revision remains caller asserted. This is not a reproducibility claim. BusyBox compilation, initramfs generation and QEMU execution are subsequent stages. Tests exercise command construction and preflight refusal, not actual kernel compilation.
