import type {
  BatchTask,
  CreationTask,
  RiskItem,
  ValidationVm,
  VmConfiguration,
  VmTask,
} from "@/domain/models";
export const initialRisks: RiskItem[] = [
  {
    id: 1,
    description: "3 台 ESXi 主机 CPU 指令集不满足目标虚拟化平台兼容要求",
    level: "high",
    stage: "research",
    batchId: "B-001",
    vmName: "VM-APP-001",
    vmId: "VMID-1001",
    closed: false,
    closedAt: "—",
    closureDescription: "—",
  },
  {
    id: 2,
    description: "售前调用表缺少核心业务峰值 IOPS 与时延基线",
    level: "high",
    stage: "research",
    batchId: "全局",
    vmName: "多台虚拟机",
    vmId: "—",
    closed: false,
    closedAt: "—",
    closureDescription: "—",
  },
  {
    id: 3,
    description: "NAS ACL 映射规则与目标端权限模型存在差异",
    level: "medium",
    stage: "research",
    batchId: "B-003",
    vmName: "VM-NAS-017",
    vmId: "VMID-1017",
    closed: false,
    closedAt: "—",
    closureDescription: "—",
  },
  {
    id: 4,
    description: "对象存储 SDK 版本低于目标平台兼容版本",
    level: "low",
    stage: "research",
    batchId: "B-005",
    vmName: "VM-APP-042",
    vmId: "VMID-1042",
    closed: true,
    closedAt: "2026-08-31 16:20",
    closureDescription: "已确认目标平台兼容 SDK 版本，并完成业务侧升级验证。",
  },
];

export const planningRisks: RiskItem[] = [
  {
    id: 5,
    description: "核心交易 RAC 集群跨批次迁移可能导致短时业务链路不一致",
    level: "high",
    stage: "planning",
    batchId: "B-002",
    vmName: "VM-DB-002",
    vmId: "VMID-1002",
    closed: false,
    closedAt: "—",
    closureDescription: "—",
  },
  {
    id: 6,
    description: "6 台虚拟机未填写允许迁移窗口，实施排期存在冲突风险",
    level: "medium",
    stage: "planning",
    batchId: "B-004",
    vmName: "多台虚拟机",
    vmId: "—",
    closed: false,
    closedAt: "—",
    closureDescription: "—",
  },
  {
    id: 7,
    description: "两项外围业务依赖缺少备用链路验证记录",
    level: "medium",
    stage: "planning",
    batchId: "B-006",
    vmName: "VM-WEB-087",
    vmId: "VMID-1087",
    closed: false,
    closedAt: "—",
    closureDescription: "—",
  },
  {
    id: 8,
    description: "扩展批次资源池预留容量低于建议冗余阈值",
    level: "low",
    stage: "planning",
    batchId: "B-008",
    vmName: "VM-APP-113",
    vmId: "VMID-1113",
    closed: false,
    closedAt: "—",
    closureDescription: "—",
  },
];

export function buildBatchTasks(vmNames: string[]): BatchTask[] {
  const phase: BatchTask["batchPhase"][] = [
    "pilot",
    "core",
    "core",
    "core",
    "scale",
    "scale",
    "scale",
    "scale",
  ];
  const type: BatchTask["stageType"][] = [
    "full-sync",
    "incremental-sync",
    "full-sync",
    "cutover",
    "incremental-sync",
    "full-sync",
    "cutover",
    "verify",
  ];
  return Array.from({ length: 8 }, (_, index) => {
    const start = 7 + index * 2;
    const duration =
      type[index] === "verify" ? 1 : type[index] === "cutover" ? 2 : 3;
    return {
      id: `B-${String(index + 1).padStart(3, "0")}`,
      batchPhase: phase[index],
      vmNames: vmNames.slice(
        index * 16,
        Math.min((index + 1) * 16, vmNames.length),
      ),
      stageType: type[index],
      startDate: `2026-09-${String(start).padStart(2, "0")}`,
      endDate: `2026-09-${String(start + duration - 1).padStart(2, "0")}`,
      durationDays: duration,
    };
  });
}

export function buildVmTasks(batch: BatchTask): VmTask[] {
  return batch.vmNames.map((name, index) => {
    const status: VmTask["status"] =
      index % 5 === 0
        ? "succeeded"
        : index % 4 === 0
          ? "syncing"
          : index % 7 === 0
            ? "paused"
            : "pending-sync";
    const progress =
      status === "succeeded"
        ? 100
        : status === "syncing"
          ? 64 + (index % 20)
          : status === "paused"
            ? 42
            : 0;
    return {
      id: `${batch.id}-${String(index + 1).padStart(2, "0")}`,
      name,
      batchId: batch.id,
      os:
        index % 3 === 0
          ? "Debian GNU/Linux 11"
          : index % 3 === 1
            ? "CentOS 7 (64 位)"
            : "Windows Server 2019",
      riskIds: [],
      targetIp: `10.88.${Number(batch.id.slice(2))}.${30 + index}`,
      status,
      checkStatus:
        status === "succeeded"
          ? "passed"
          : status === "syncing"
            ? "checking"
            : "pending-check",
      progress,
      migrated: `${Math.round(progress * 0.37 * 10) / 10}GB / 37GB`,
      speed: status === "syncing" ? `${82 + index * 3} MB/s` : "—",
      startTime:
        status === "pending-sync"
          ? "—"
          : `${batch.startDate} 00:${String(index * 3).padStart(2, "0")}`,
      endTime:
        status === "succeeded"
          ? `${batch.startDate} 02:${String(10 + index).padStart(2, "0")}`
          : "—",
      duration:
        status === "pending-sync" ? "—" : `${1 + (index % 3)}h ${12 + index}m`,
      remaining: status === "syncing" ? `${28 + index * 2}m` : "—",
    };
  });
}

export function buildCreationTasks(batches: BatchTask[]): CreationTask[] {
  return batches
    .flatMap(buildVmTasks)
    .slice(0, 12)
    .map((source, index) => ({
      id: `CT-${String(index + 1).padStart(3, "0")}`,
      hostName: `ESXi-${String((index % 4) + 1).padStart(2, "0")}`,
      vmName: source.name,
      sourceTaskId: source.id,
      powerState: index % 4 === 0 ? "powered-off" : "powered-on",
      os:
        index % 3 === 0
          ? "Debian GNU/Linux 11"
          : index % 3 === 1
            ? "CentOS 7 (64 位)"
            : "Windows Server 2019",
      firmware: index % 3 === 0 ? "UEFI" : "BIOS",
      cpu: index % 3 === 0 ? 6 : index % 3 === 1 ? 8 : 4,
      memory: index % 3 === 0 ? "12 GB" : index % 3 === 1 ? "64 GB" : "16 GB",
      disk:
        index % 3 === 0
          ? "70 GB"
          : index % 3 === 1
            ? "100 GB, 1024 GB"
            : "120 GB",
      vmtools: index % 4 === 0 ? "stopped" : "running",
      check: "passed",
      taskName: `迁移-${source.name}`,
      status: "unconfigured",
    }));
}

export function buildValidationTasks(
  tasks: VmTask[],
  batches: BatchTask[],
): ValidationVm[] {
  return tasks.map((task, index) => {
    const batchId = task.batchId;
    const batch = batches.find((item) => item.id === batchId);
    const config: VmConfiguration = {
      cpu: {
        totalCores: index % 3 === 0 ? "8 核" : "4 核",
        reservation: "0 MHz",
        shares: "普通（1000/核）",
        limit: "不限",
        hotPlug: "关闭",
      },
      memory: {
        totalSize: index % 3 === 0 ? "32 GB" : "16 GB",
        reservation: "0 MB",
        shares: "普通（10/MB）",
        hotPlug: "关闭",
      },
      disk: {
        busType: "SCSI",
        slot: "0:0",
        size: index % 2 === 0 ? "120 GB" : "80 GB",
        type: "精简置备",
      },
      network: {
        ip: task.targetIp,
        mac: `FA:16:3E:${String(20 + index).padStart(2, "0")}:7A:${String(40 + index).padStart(2, "0")}`,
        busNumber: "0",
        route: "0.0.0.0/0",
        ioRing: "256",
        queues: "4",
        pollAcceleration: "开启",
        dns: "10.88.0.10, 10.88.0.11",
        gateway: "10.88.0.1",
        tcpIpStack: "默认 TCP/IP 协议栈",
      },
      display: { type: "VGA", memory: "4 MB" },
    };
    return {
      id: `VAL-${task.id}`,
      sourceTaskId: task.id,
      batchId,
      batchPhase: batch?.batchPhase ?? "core",
      vmName: task.name,
      uuid: `4200-${String(1100 + index)}-a9e3-${String(8300 + index)}-dce7f2b1`,
      osType:
        index % 2 === 0 ? "CentOS 7.9 (64 位)" : "Windows Server 2019 (64 位)",
      source: config,
      target: {
        ...config,
        cpu: { ...config.cpu },
        memory: { ...config.memory },
        disk: { ...config.disk },
        network: { ...config.network },
        display: { ...config.display },
      },
      comparison: "matched",
      confirmed: false,
    };
  });
}
