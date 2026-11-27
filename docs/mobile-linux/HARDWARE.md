# Hardware architecture prototype

Offline inspection of public or authorised images only. FDT v17 provides node paths, compatible strings, status, phandles and containment plus interrupt-parent and supply references. Android DT table v0 provides bounded entry metadata and hashes. Vendor boot v3/v4 provides ramdisk, DTB, table and bootconfig ranges and fragment metadata.

Run:

```sh
node experiments/mobile-linux/inspect-hardware.mjs dtb board.dtb
node experiments/mobile-linux/inspect-hardware.mjs dtbo dtbo.img
node experiments/mobile-linux/inspect-hardware.mjs vendor-boot vendor_boot.img
node --test experiments/mobile-linux/*.test.mjs
```

No overlay application, clock/GPIO/I2C/SPI binding interpretation, AVB authentication, driver matching, or live device access. Unknown references stay unresolved. Inputs are capped at 32 MiB for DT and 128 MiB for vendor boot. Hashes identify bytes, not authenticity. Synthetic tests do not establish manufacturer compatibility.

Reference formats: https://devicetree-specification.readthedocs.io/ and https://source.android.com/docs/core/architecture/bootloader/vendor-boot-partitions and https://source.android.com/docs/core/architecture/dto/partitions.
