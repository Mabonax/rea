import { createHash } from "node:crypto";

const required = Object.freeze({
 CONFIG_ARM64:"y", CONFIG_OF:"y", CONFIG_BLK_DEV_INITRD:"y",
 CONFIG_BINFMT_ELF:"y", CONFIG_BINFMT_SCRIPT:"y", CONFIG_RD_GZIP:"y",
 CONFIG_DEVTMPFS:"y", CONFIG_TMPFS:"y", CONFIG_PROC_FS:"y", CONFIG_SYSFS:"y",
 CONFIG_TTY:"y", CONFIG_SERIAL_AMBA_PL011:"y", CONFIG_SERIAL_AMBA_PL011_CONSOLE:"y",
 CONFIG_VIRTIO:"y", CONFIG_VIRTIO_MMIO:"y",
});
const optional = Object.freeze({
 CONFIG_NET:"y", CONFIG_INET:"y", CONFIG_NETDEVICES:"y", CONFIG_VIRTIO_NET:"y",
 CONFIG_BLOCK:"y", CONFIG_VIRTIO_BLK:"y", CONFIG_EXT4_FS:"y",
});
const record=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const digest=x=>typeof x==="string"&&/^[a-f0-9]{64}$/u.test(x);
const revision=x=>typeof x==="string"&&/^[a-f0-9]{40}$/u.test(x);

export function createBuildPlan(input){
 if(!record(input)||input.schema_version!==1||input.target!=="qemu-arm64-virt"||
 !record(input.kernel)||!revision(input.kernel.revision)||!digest(input.kernel.archive_sha256)||
 !record(input.busybox)||!revision(input.busybox.revision)||!digest(input.busybox.archive_sha256)||
 !Number.isInteger(input.jobs)||input.jobs<1||input.jobs>32||
 typeof input.virtio_extras!=="boolean") throw new TypeError("Invalid pinned QEMU build inputs");
 const requested={...required,...(input.virtio_extras?optional:{})};
 const fragment=Object.keys(requested).sort().map(k=>k+"="+requested[k]).join("\n")+"\n";
 const plan={schema_version:1,target:input.target,architecture:"arm64",
  kernel:{revision:input.kernel.revision,archive_sha256:input.kernel.archive_sha256},
  busybox:{revision:input.busybox.revision,archive_sha256:input.busybox.archive_sha256},
  jobs:input.jobs,configuration:requested,fragment,
  fragment_sha256:createHash("sha256").update(fragment).digest("hex"),
  stages:["verify_input_sources","prepare_isolated_output","arm64_defconfig","merge_fragment","olddefconfig","verify_effective_config","compile_image","build_static_busybox","assemble_initramfs","qemu_boot_test"],
  toolchain:{prefix:"aarch64-linux-gnu-",kernel_arch:"arm64"},
  expected_artifacts:["Image","initramfs.cpio.gz","effective.config","manifest.json"],
  boot:{machine:"virt",cpu:"cortex-a57",memory_mib:512,serial:"ttyAMA0",network:"disabled",success_marker:"REA_MOBILE_BOOT_OK"},
  source_verification:"pending",build_status:"not_executed",physical_boot_status:"not_verified",device_mutation_allowed:false};
 return plan;
}
export function checkEffectiveConfig(plan,source){
 if(!record(plan)||!record(plan.configuration)||typeof source!=="string"||Buffer.byteLength(source)>8*1024*1024||source.includes("\0"))throw new TypeError("Invalid effective configuration");
 const values=new Map();
 for(const line of source.split(/\r?\n/u)){
  const set=/^(CONFIG_[A-Z0-9_]+)=(.*)$/u.exec(line),unset=/^# (CONFIG_[A-Z0-9_]+) is not set$/u.exec(line);
  if(!set&&!unset)continue;
  const key=(set??unset)[1],value=set?set[2]:"n";
  if(values.has(key)&&values.get(key)!==value)throw new TypeError("Conflicting effective config: "+key);
  values.set(key,value);
 }
 const mismatches=Object.entries(plan.configuration).filter(([key,value])=>values.get(key)!==value).map(([key,expected])=>({key,expected,actual:values.get(key)??null}));
 return {status:mismatches.length?"requirements_unmet":"requirements_met",mismatches,configuration_sha256:createHash("sha256").update(source).digest("hex"),bootability:"not_verified"};
}
