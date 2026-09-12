'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AgentPanel, Icon, ShortcutMenu, type QuickGroup, type WorkStep } from './workspace-ui';
import { ThemePicker } from './theme-picker';

import { StageConversationList, StageHandoff, createStageConversation, initialStageConversations, mainConversationId, type StageConversation, type StageId } from './stage-conversations';

interface ConversationView { draft?: string; typing?: boolean; workOpen?: boolean; panel?: PanelId }
type PanelId = 'risk' | 'tasks' | 'creation' | 'cutover' | 'sync' | 'validation' | 'deliverables' | 'logs' | null;
type AssessmentStatus = 'idle' | 'ready' | 'running' | 'completed';
type PlanningStatus = 'locked' | 'scope-review' | 'details-pending' | 'generating' | 'completed';
type BatchConfirmationStatus = 'pending' | 'adjusting' | 'confirmed';
type MdStatus = 'unconfigured' | 'checking-connection' | 'connected' | 'checking-config' | 'ready';
type ExecutionTaskKind = 'creation' | 'cutover' | 'sync';

interface ProjectInfo {
  industry: string;
  region: string;
  office: string;
  siteName: string;
  migrationType: string;
}

interface RiskItem {
  id: number;
  description: string;
  level: '高' | '中' | '低';
  stage: StageId;
  batchId: string;
  vmName: string;
  vmId: string;
  closed: boolean;
  closedAt: string;
  closureDescription: string;
}

interface ChatMessage {
  id: number;
  role: 'agent' | 'user' | 'system';
  text: string;
  time: string;
  conversationId: string;
  stageId?: StageId;
  operation?: boolean;
}

interface StageView {
  id: StageId;
  number: string;
  title: string;
  english: string;
  agent: string;
  description: string;
  status: 'completed' | 'running' | 'pending';
  progress: number;
  tone: string;
  actions: { label: string; value: string; state?: 'alert' | 'good'; kind?: 'risk' | 'report' | 'tasks' | 'create' | 'cutover' | 'sync' | 'validation' | 'md' | 'scope' | 'planning' | 'plan' | 'runbook' }[];
}

interface BatchTask {
  id: string;
  batchPhase: '试点' | '攻坚' | '扩展';
  vmNames: string[];
  stageType: '全量同步' | '增量同步' | '割接验证' | '验证';
  startDate: string;
  endDate: string;
  durationDays: number;
}

interface VmTask {
  id: string;
  name: string;
  targetIp: string;
  status: '待同步' | '同步中' | '成功' | '暂停';
  checkStatus: '待校验' | '校验中' | '通过';
  progress: number;
  migrated: string;
  speed: string;
  startTime: string;
  endTime: string;
  duration: string;
  remaining: string;
}

interface CreationTask {
  id: string;
  hostName: string;
  vmName: string;
  powerState: '开机' | '关机';
  os: string;
  firmware: 'BIOS' | 'UEFI';
  cpu: number;
  memory: string;
  disk: string;
  vmtools: string;
  check: '通过';
  taskName: string;
  status: '待配置' | '已确认' | '已创建';
}

interface VmConfiguration {
  cpu: { totalCores: string; reservation: string; shares: string; limit: string; hotPlug: string };
  memory: { totalSize: string; reservation: string; shares: string; hotPlug: string };
  disk: { busType: string; slot: string; size: string; type: string };
  network: { ip: string; mac: string; busNumber: string; route: string; ioRing: string; queues: string; pollAcceleration: string; dns: string; gateway: string; tcpIpStack: string };
  display: { type: string; memory: string };
}

interface ValidationVm {
  id: string;
  batchId: string;
  batchPhase: BatchTask['batchPhase'];
  vmName: string;
  uuid: string;
  osType: string;
  source: VmConfiguration;
  target: VmConfiguration;
  comparison: '一致' | '存在差异';
  confirmed: boolean;
}

interface ExecutionMetric {
  total: number;
  completed: number;
  queued: number;
  running: number;
}

interface MdHistoryItem {
  id: number;
  time: string;
  title: string;
  detail: string;
}

const stageMeta = [
  { id: 'research' as const, number: '01', title: '调研评估', english: 'DISCOVERY & ASSESSMENT', agent: '评估子智能体', description: '解析采集数据与售前信息，识别迁移范围、资源和交付风险。', tone: 'cyan' },
  { id: 'planning' as const, number: '02', title: '规划设计', english: 'STRATEGY & DESIGN', agent: '规划子智能体', description: '制定目标架构、迁移批次、资源计划与回退策略。', tone: 'violet' },
  { id: 'migration' as const, number: '03', title: '迁移实施', english: 'MIGRATION EXECUTION', agent: '实施子智能体', description: '按批次执行迁移任务，实时监控进度并自动处理异常。', tone: 'blue' },
  { id: 'validation' as const, number: '04', title: '结果验证', english: 'RESULT VALIDATION', agent: '验证子智能体', description: '自动完成数据、应用和业务验证，输出交付验收证据。', tone: 'emerald' },
];

const initialRisks: RiskItem[] = [
  { id: 1, description: '3 台 ESXi 主机 CPU 指令集不满足目标虚拟化平台兼容要求', level: '高', stage: 'research', batchId: 'B-001', vmName: 'VM-APP-001', vmId: 'VMID-1001', closed: false, closedAt: '—', closureDescription: '—' },
  { id: 2, description: '售前调用表缺少核心业务峰值 IOPS 与时延基线', level: '高', stage: 'research', batchId: '全局', vmName: '多台虚拟机', vmId: '—', closed: false, closedAt: '—', closureDescription: '—' },
  { id: 3, description: 'NAS ACL 映射规则与目标端权限模型存在差异', level: '中', stage: 'research', batchId: 'B-003', vmName: 'VM-NAS-017', vmId: 'VMID-1017', closed: false, closedAt: '—', closureDescription: '—' },
  { id: 4, description: '对象存储 SDK 版本低于目标平台兼容版本', level: '低', stage: 'research', batchId: 'B-005', vmName: 'VM-APP-042', vmId: 'VMID-1042', closed: true, closedAt: '2026-08-31 16:20', closureDescription: '已确认目标平台兼容 SDK 版本，并完成业务侧升级验证。' },
];

const planningRisks: RiskItem[] = [
  { id: 5, description: '核心交易 RAC 集群跨批次迁移可能导致短时业务链路不一致', level: '高', stage: 'planning', batchId: 'B-002', vmName: 'VM-DB-002', vmId: 'VMID-1002', closed: false, closedAt: '—', closureDescription: '—' },
  { id: 6, description: '6 台虚拟机未填写允许迁移窗口，实施排期存在冲突风险', level: '中', stage: 'planning', batchId: 'B-004', vmName: '多台虚拟机', vmId: '—', closed: false, closedAt: '—', closureDescription: '—' },
  { id: 7, description: '两项外围业务依赖缺少备用链路验证记录', level: '中', stage: 'planning', batchId: 'B-006', vmName: 'VM-WEB-087', vmId: 'VMID-1087', closed: false, closedAt: '—', closureDescription: '—' },
  { id: 8, description: '扩展批次资源池预留容量低于建议冗余阈值', level: '低', stage: 'planning', batchId: 'B-008', vmName: 'VM-APP-113', vmId: 'VMID-1113', closed: false, closedAt: '—', closureDescription: '—' },
];

const stageName: Record<StageId, string> = { research: '调研评估', planning: '规划设计', migration: '迁移实施', validation: '结果验证' };
const blankProject: ProjectInfo = { industry: '金融', region: '中国地区部', office: '', siteName: '', migrationType: '虚拟化' };

function now() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function excelXml(sheets: { name: string; rows: (string | number)[][] }[]) {
  const escape = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const worksheets = sheets.map((sheet) => `<Worksheet ss:Name="${escape(sheet.name)}"><Table>${sheet.rows.map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${escape(cell)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet>`).join('');
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheets}</Workbook>`;
}

function excelHref(sheets: { name: string; rows: (string | number)[][] }[]) {
  return `data:application/vnd.ms-excel;charset=utf-8,${encodeURIComponent(excelXml(sheets))}`;
}

function buildBatchTasks(vmNames: string[]): BatchTask[] {
  const phase: BatchTask['batchPhase'][] = ['试点', '攻坚', '攻坚', '攻坚', '扩展', '扩展', '扩展', '扩展'];
  const type: BatchTask['stageType'][] = ['全量同步', '增量同步', '全量同步', '割接验证', '增量同步', '全量同步', '割接验证', '验证'];
  return Array.from({ length: 8 }, (_, index) => {
    const start = 7 + index * 2;
    const duration = type[index] === '验证' ? 1 : type[index] === '割接验证' ? 2 : 3;
    return {
      id: `B-${String(index + 1).padStart(3, '0')}`,
      batchPhase: phase[index],
      vmNames: vmNames.slice(index * 16, Math.min((index + 1) * 16, vmNames.length)),
      stageType: type[index],
      startDate: `2026-09-${String(start).padStart(2, '0')}`,
      endDate: `2026-09-${String(start + duration - 1).padStart(2, '0')}`,
      durationDays: duration,
    };
  });
}

function buildVmTasks(batch: BatchTask): VmTask[] {
  return batch.vmNames.map((name, index) => {
    const status: VmTask['status'] = index % 5 === 0 ? '成功' : index % 4 === 0 ? '同步中' : index % 7 === 0 ? '暂停' : '待同步';
    const progress = status === '成功' ? 100 : status === '同步中' ? 64 + index % 20 : status === '暂停' ? 42 : 0;
    return {
      id: `${batch.id}-${String(index + 1).padStart(2, '0')}`,
      name,
      targetIp: `10.88.${Number(batch.id.slice(2))}.${30 + index}`,
      status,
      checkStatus: status === '成功' ? '通过' : status === '同步中' ? '校验中' : '待校验',
      progress,
      migrated: `${Math.round(progress * .37 * 10) / 10}GB / 37GB`,
      speed: status === '同步中' ? `${82 + index * 3} MB/s` : '—',
      startTime: status === '待同步' ? '—' : `${batch.startDate} 00:${String(index * 3).padStart(2, '0')}`,
      endTime: status === '成功' ? `${batch.startDate} 02:${String(10 + index).padStart(2, '0')}` : '—',
      duration: status === '待同步' ? '—' : `${1 + index % 3}h ${12 + index}m`,
      remaining: status === '同步中' ? `${28 + index * 2}m` : '—',
    };
  });
}

function buildCreationTasks(batches: BatchTask[]): CreationTask[] {
  return batches.flatMap((batch) => batch.vmNames).slice(0, 12).map((vmName, index) => ({
    id: `CT-${String(index + 1).padStart(3, '0')}`,
    hostName: `ESXi-${String(index % 4 + 1).padStart(2, '0')}`,
    vmName,
    powerState: index % 4 === 0 ? '关机' : '开机',
    os: index % 3 === 0 ? 'Debian GNU/Linux 11' : index % 3 === 1 ? 'CentOS 7 (64 位)' : 'Windows Server 2019',
    firmware: index % 3 === 0 ? 'UEFI' : 'BIOS',
    cpu: index % 3 === 0 ? 6 : index % 3 === 1 ? 8 : 4,
    memory: index % 3 === 0 ? '12 GB' : index % 3 === 1 ? '64 GB' : '16 GB',
    disk: index % 3 === 0 ? '70 GB' : index % 3 === 1 ? '100 GB, 1024 GB' : '120 GB',
    vmtools: index % 4 === 0 ? '未运行' : '运行中',
    check: '通过',
    taskName: `迁移-${vmName}`,
    status: '待配置',
  }));
}

function buildValidationTasks(tasks: VmTask[], batches: BatchTask[]): ValidationVm[] {
  return tasks.map((task, index) => {
    const batchId = task.id.split('-').slice(0, 2).join('-');
    const batch = batches.find((item) => item.id === batchId);
    const config: VmConfiguration = {
      cpu: { totalCores: index % 3 === 0 ? '8 核' : '4 核', reservation: '0 MHz', shares: '普通（1000/核）', limit: '不限', hotPlug: '关闭' },
      memory: { totalSize: index % 3 === 0 ? '32 GB' : '16 GB', reservation: '0 MB', shares: '普通（10/MB）', hotPlug: '关闭' },
      disk: { busType: 'SCSI', slot: '0:0', size: index % 2 === 0 ? '120 GB' : '80 GB', type: '精简置备' },
      network: { ip: task.targetIp, mac: `FA:16:3E:${String(20 + index).padStart(2, '0')}:7A:${String(40 + index).padStart(2, '0')}`, busNumber: '0', route: '0.0.0.0/0', ioRing: '256', queues: '4', pollAcceleration: '开启', dns: '10.88.0.10, 10.88.0.11', gateway: '10.88.0.1', tcpIpStack: '默认 TCP/IP 协议栈' },
      display: { type: 'VGA', memory: '4 MB' },
    };
    return {
      id: `VAL-${task.id}`,
      batchId,
      batchPhase: batch?.batchPhase ?? '攻坚',
      vmName: task.name,
      uuid: `4200-${String(1100 + index)}-a9e3-${String(8300 + index)}-dce7f2b1`,
      osType: index % 2 === 0 ? 'CentOS 7.9 (64 位)' : 'Windows Server 2019 (64 位)',
      source: config,
      target: { ...config, cpu: { ...config.cpu }, memory: { ...config.memory }, disk: { ...config.disk }, network: { ...config.network }, display: { ...config.display } },
      comparison: '一致',
      confirmed: false,
    };
  });
}

const subscribeViewport = (callback: () => void) => {
  const media = window.matchMedia('(min-width: 981px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const getWideViewport = () => window.matchMedia('(min-width: 981px)').matches;
const getServerViewport = () => true;

interface ProjectEntry { id: string; info: ProjectInfo }

export default function Home() {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [selected, setSelected] = useState('lobby');
  const [creating, setCreating] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  return <>
    {creating && <ProjectSetup onCancel={() => setCreating(false)} onCreate={(info) => {
      const id = crypto.randomUUID();
      setProjects((items) => [...items, { id, info }]);
      setSelected(id);
      setCreating(false);
    }} />}
    {[{ id: 'lobby', info: null }, ...projects].map((entry) => <div key={entry.id} hidden={creating || selected !== entry.id}>
      <ProjectWorkspace navCollapsed={navCollapsed} onNavCollapsedChange={setNavCollapsed} visible={!creating && selected === entry.id} project={entry.info} projects={projects} projectId={entry.id} onSelectProject={setSelected} onNewProject={() => setCreating(true)} />
    </div>)}
  </>;
}

function ProjectSetup({ onCreate, onCancel }: { onCreate: (project: ProjectInfo) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<ProjectInfo>(blankProject);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.office.trim() && draft.siteName.trim()) onCreate({ ...draft, office: draft.office.trim(), siteName: draft.siteName.trim() });
  }
  return <main className="project-setup-page">
    <header><span><span className="huawei-symbol" role="img" aria-label="华为" />MigrationDirector Plus</span><button onClick={onCancel}><Icon name="close" size={16} />返回工作空间</button></header>
    <form className="project-setup" onSubmit={submit}>
      <Icon name="folder" size={28} /><h1>新建迁移项目</h1><p>先建立项目，再从调研评估开始推进交付。</p>
      <div className="project-form-grid">
        <label className="full-field"><span>项目名称</span><input autoFocus required maxLength={60} value={draft.siteName} onChange={(e) => setDraft({ ...draft, siteName: e.target.value })} placeholder="例如：华东数据中心迁移" /></label>
        <label><span>行业</span><select value={draft.industry} onChange={(e) => setDraft({ ...draft, industry: e.target.value })}>{['金融', '运营商', '公安', '政府', '教育'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>迁移类型</span><select value={draft.migrationType} onChange={(e) => setDraft({ ...draft, migrationType: e.target.value })}>{['虚拟化', 'SAN', 'NAS', '对象'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>地区部</span><select value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })}>{['中国地区部', '中亚地区部', '亚太地区部'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>代表处</span><input required maxLength={60} value={draft.office} onChange={(e) => setDraft({ ...draft, office: e.target.value })} placeholder="例如：上海代表处" /></label>
      </div>
      <div className="setup-next"><Icon name="info" size={16} /><p>创建后自动开启评估会话。任务、风险、交付件和操作记录都归属当前项目。</p></div>
      <div className="setup-actions"><button type="button" onClick={onCancel}>取消</button><button className="primary" type="submit">创建项目，开始评估<Icon name="right" size={16} /></button></div>
    </form>
  </main>;
}

function ProjectWorkspace({ navCollapsed, onNavCollapsedChange, visible, project, projects, projectId, onSelectProject, onNewProject }: { navCollapsed: boolean; onNavCollapsedChange: (collapsed: boolean) => void; visible: boolean; project: ProjectInfo | null; projects: ProjectEntry[]; projectId: string; onSelectProject: (id: string) => void; onNewProject: () => void }) {
  const [activeStage, setActiveStage] = useState<StageId>('research');
  const [enteredStages, setEnteredStages] = useState<StageId[]>(project ? ['research'] : []);
  const [transitionReview, setTransitionReview] = useState<StageId | null>(null);
  const [managementPanel, setManagementPanel] = useState<PanelId>(null);
  const [navOpen, setNavOpen] = useState(false);
  const collapseNavButton = useRef<HTMLButtonElement>(null);
  const expandNavButton = useRef<HTMLButtonElement>(null);
  function toggleNavigation(collapsed: boolean) {
    onNavCollapsedChange(collapsed);
    requestAnimationFrame(() => (collapsed ? expandNavButton : collapseNavButton).current?.focus());
  }
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const wideViewport = useSyncExternalStore(subscribeViewport, getWideViewport, getServerViewport);
  const [temporaryChats, setTemporaryChats] = useState<{ id: string; title: string }[]>([]);
  const [temporaryChat, setTemporaryChat] = useState<string | null>(null);
  const [stageConversations, setStageConversations] = useState<StageConversation[]>(initialStageConversations);
  const [lastStageChats, setLastStageChats] = useState<Partial<Record<StageId, string>>>({});
  const stageConversationId = lastStageChats[activeStage] || mainConversationId(activeStage);
  const conversationId = temporaryChat || stageConversationId;
  const currentStageChat = stageConversations.find((chat) => chat.id === stageConversationId)!;
  const [conversationViews, setConversationViews] = useState<Record<string, ConversationView>>({});
  const view = conversationViews[conversationId] || {};
  const question = view.draft || '';
  const agentTyping = Boolean(view.typing);
  const showWorkflow = currentStageChat.kind === 'main' || Boolean(view.workOpen);
  const panel = managementPanel || view.panel || null;
  const operationOrigins = useRef(new Map<string, { conversationId: string; stageId: StageId }>());
  const replyLocks = useRef(new Set<string>());
  const adjustmentOwner = useRef<string | null>(null);
  const executionAnnounced = useRef(new Set<ExecutionTaskKind>());
  function updateConversationView(patch: Partial<ConversationView>, target = conversationId) {
    setConversationViews((items) => ({ ...items, [target]: { ...items[target], ...patch } }));
  }
  function setQuestion(draft: string) { updateConversationView({ draft }); }
  function setAgentTyping(typing: boolean) { updateConversationView({ typing }); }
  function setPanelValue(next: PanelId) {
    if (next === null && managementPanel) { setManagementPanel(null); return; }
    if (next && ['tasks', 'risk', 'deliverables', 'logs'].includes(next)) setManagementPanel(next);
    else { setManagementPanel(null); updateConversationView({ panel: next }); }
  }
  function claimOperation(key: string, allowed = true) {
    if (!allowed || operationOrigins.current.has(key)) { setToast('该操作正在执行、已经完成或尚未满足前置条件'); return false; }
    operationOrigins.current.set(key, { conversationId, stageId: activeStage });
    return true;
  }

  const isManagement = panel !== null && ['tasks', 'risk', 'deliverables', 'logs'].includes(panel);
  const showStageRail = !temporaryChat && !isManagement;
  const showInspector = Boolean(project && !temporaryChat && !isManagement && (wideViewport ? inspectorOpen : compactInspectorOpen));
  const toggleInspector = () => wideViewport ? setInspectorOpen((value) => !value) : setCompactInspectorOpen((value) => !value);
  const conversation = useRef<HTMLDivElement>(null);
  const inlineWork = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const [assessmentStatus, setAssessmentStatus] = useState<AssessmentStatus>('idle');
  const [planningStatus, setPlanningStatus] = useState<PlanningStatus>('locked');
  const [vmCount, setVmCount] = useState(128);
  const [scopeRevisionFile, setScopeRevisionFile] = useState('');
  const [planningWorkbook, setPlanningWorkbook] = useState('');
  const [batchConfirmation, setBatchConfirmation] = useState<BatchConfirmationStatus>('pending');
  const [mdStatus, setMdStatus] = useState<MdStatus>('unconfigured');
  const [mdHistory, setMdHistory] = useState<MdHistoryItem[]>([]);
  const [executionApprovals, setExecutionApprovals] = useState<Record<ExecutionTaskKind, boolean>>({ creation: false, cutover: false, sync: false });
  const [executionStarted, setExecutionStarted] = useState(false);
  const [executionMetrics, setExecutionMetrics] = useState<Record<ExecutionTaskKind, ExecutionMetric>>({ creation: { total: 0, completed: 0, queued: 0, running: 0 }, cutover: { total: 0, completed: 0, queued: 0, running: 0 }, sync: { total: 0, completed: 0, queued: 0, running: 0 } });
  const [files, setFiles] = useState({ rvtools: '', presales: '' });
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [batchTasks, setBatchTasks] = useState<BatchTask[]>([]);
  const [creationTasks, setCreationTasks] = useState<CreationTask[]>([]);
  const [validationTasks, setValidationTasks] = useState<ValidationVm[]>([]);

  const [toast, setToast] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => project ? [
    { id: 1, role: 'system', text: `项目「${project.siteName}」已创建，评估会话已开启。`, time: now(), conversationId: mainConversationId('research'), stageId: 'research', operation: true },
    { id: 2, role: 'agent', text: '我们从调研评估开始。请上传 RVTools 采集表和售前调用表，也可以先使用示例资料体验流程。\n\n我会核对资产清单与兼容性，把结果汇总到项目风险和交付件中。', time: now(), conversationId: mainConversationId('research'), stageId: 'research' },
  ] : []);
  const visibleMessages = messages.filter((message) => message.conversationId === conversationId);
  const validationAnnounced = useRef(false);
  const availableStages = Object.fromEntries(stageMeta.map((stage) => [stage.id, enteredStages.includes(stage.id)])) as Record<StageId, boolean>;
  function newChat() {
    setTransitionReview(null);
    const id = `chat-${crypto.randomUUID()}`;
    setTemporaryChats((items) => [...items, { id, title: '新聊天' }]);
    setTemporaryChat(id); setManagementPanel(null); setNavOpen(false);
    window.setTimeout(() => composer.current?.focus(), 50);
  }
  function openChat(id: string) { setTransitionReview(null); setTemporaryChat(id); setManagementPanel(null); setNavOpen(false); }

  function openStageChat(id: string) {
    setTransitionReview(null);
    const chat = stageConversations.find((item) => item.id === id);
    if (!chat || !availableStages[chat.stageId]) return;
    setLastStageChats((items) => ({ ...items, [chat.stageId]: id }));
    setActiveStage(chat.stageId); setTemporaryChat(null); setManagementPanel(null); setNavOpen(false);
  }
  function newStageChat() {
    setTransitionReview(null);
    if (!project || !availableStages[activeStage]) return;
    const id = `stage-chat-${crypto.randomUUID()}`;
    setStageConversations((items) => [...items, { id, stageId: activeStage, title: '新会话', kind: 'child' }]);
    setLastStageChats((items) => ({ ...items, [activeStage]: id }));
    setTemporaryChat(null); setManagementPanel(null); setNavOpen(false);
    window.setTimeout(() => composer.current?.focus(), 50);
  }
  function renameStageChat(id: string, title: string) {
    setStageConversations((items) => items.map((chat) => chat.id === id ? { ...chat, title, manuallyNamed: true } : chat));
  }
  function showStageWork() {
    if (!project || !availableStages[activeStage]) return;
    setPanelValue(null); updateConversationView({ workOpen: true });
  }

  const projectName = project?.siteName || '暂无迁移项目';
  const highRiskOpen = risks.filter((risk) => risk.level === '高' && !risk.closed);
  const canStartAssessment = Boolean(project && files.rvtools && files.presales && assessmentStatus !== 'running' && assessmentStatus !== 'completed');
  const todayCutoverTasks = useMemo(() => {
    const todayBatch = batchTasks.find((batch) => batch.stageType === '割接验证');
    return todayBatch ? buildVmTasks(todayBatch) : [];
  }, [batchTasks]);
  const completedBatchIds = batchTasks.filter((batch) => {
    const tasks = validationTasks.filter((task) => task.batchId === batch.id);
    return tasks.length > 0 && tasks.length === batch.vmNames.length && tasks.every((task) => task.confirmed);
  }).map((batch) => batch.id);
  const confirmedValidationCount = validationTasks.filter((task) => task.confirmed).length;
  const allExecutionApproved = (['creation', 'cutover', 'sync'] as ExecutionTaskKind[]).every((kind) => executionApprovals[kind]);
  const mdStatusText: Record<MdStatus, string> = {
    unconfigured: '待配置',
    'checking-connection': '连接检查中',
    connected: '连接正常',
    'checking-config': '配置检查中',
    ready: '连接正常',
  };

  const researchHigh = risks.filter((risk) => risk.stage === 'research' && risk.level === '高' && !risk.closed).length;
  const planningHigh = risks.filter((risk) => risk.stage === 'planning' && risk.level === '高' && !risk.closed).length;
  const planned = planningStatus === 'completed';
  const assessed = assessmentStatus === 'completed';
  const step = (label: string, detail: string, done: boolean, active = false, blocked = false): WorkStep => ({ label, detail, state: done ? 'done' : blocked ? 'blocked' : active ? 'active' : 'waiting' });
  const stageSteps: Record<StageId, WorkStep[]> = {
    research: [
      step('核对输入资料', `${Number(Boolean(files.rvtools)) + Number(Boolean(files.presales))} / 2 份资料已就绪`, Boolean(files.rvtools && files.presales), Boolean(project)),
      step('解析资产清单', assessed ? `已识别 ${vmCount} 台虚拟机` : '核对资源配置与容量基线', assessed, assessmentStatus === 'running'),
      step('兼容性与风险评估', assessed ? `识别 ${risks.filter((r) => r.stage === 'research').length} 项风险` : '检查源端与目标端兼容性', assessed, assessmentStatus === 'running'),
      step('确认评估结果', assessed && !researchHigh ? '高风险已闭环，可以进入规划' : assessed ? `${researchHigh} 项高风险待人工确认` : '输出评估报告，确认风险', assessed && !researchHigh, false, assessed && researchHigh > 0),
    ],
    planning: [
      step('确认迁移范围', `${vmCount} 台虚拟机`, ['details-pending', 'generating', 'completed'].includes(planningStatus), planningStatus === 'scope-review'),
      step('补充业务信息', '业务分级、依赖关系与迁移窗口', Boolean(planningWorkbook), planningStatus === 'details-pending'),
      step('生成批次与 RunBook', planned ? `${batchTasks.length} 个批次已生成` : '按试点、攻坚、扩展组织计划', planned, planningStatus === 'generating'),
      step('确认风险与批次', planned && planningHigh ? `${planningHigh} 项高风险待闭环` : '人工确认后进入实施', batchConfirmation === 'confirmed', planned && !planningHigh && batchConfirmation !== 'confirmed', planned && planningHigh > 0),
    ],
    migration: [
      step('连接近端 MD', '检查心跳与项目身份', ['connected', 'checking-config', 'ready'].includes(mdStatus), mdStatus === 'checking-connection'),
      step('检查源端与目标端', 'VMware、FusionCompute 和端口映射', mdStatus === 'ready', ['connected', 'checking-config'].includes(mdStatus)),
      ...(['creation', 'sync', 'cutover'] as ExecutionTaskKind[]).map((kind) => step(({ creation: '创建迁移任务', sync: '增量数据同步', cutover: '执行割接任务' })[kind], `${executionMetrics[kind].completed} / ${executionMetrics[kind].total} 已完成${!executionApprovals[kind] ? ' · 待确认' : ''}`, executionMetrics[kind].total > 0 && executionMetrics[kind].completed === executionMetrics[kind].total, executionApprovals[kind] && executionMetrics[kind].completed < executionMetrics[kind].total)),
    ],
    validation: [
      step('采集源端与目标端配置', `${validationTasks.length} 台虚拟机进入验证`, validationTasks.length > 0),
      step('对比 25 项配置', 'CPU、内存、磁盘、网络、显卡', validationTasks.length > 0),
      step('人工确认验收', `${confirmedValidationCount} / ${validationTasks.length} 台已确认`, validationTasks.length > 0 && confirmedValidationCount === validationTasks.length, validationTasks.length > 0 && confirmedValidationCount < validationTasks.length),
      step('更新批次结果', `${completedBatchIds.length} 个批次迁移完成`, completedBatchIds.length > 0),
    ],
  };
  const runningStages: Record<StageId, boolean> = {
    research: assessmentStatus === 'running',
    planning: planningStatus === 'generating',
    migration: ['checking-connection', 'connected', 'checking-config'].includes(mdStatus) || (['creation', 'sync', 'cutover'] as ExecutionTaskKind[]).some((kind) => executionApprovals[kind] && executionMetrics[kind].completed < executionMetrics[kind].total),
    validation: false,
  };
  const workflowStage: StageId = enteredStages.at(-1) || 'research';
  const readyStages: Record<StageId, boolean> = {
    research: Boolean(project),
    planning: availableStages.research && assessed && researchHigh === 0,
    migration: availableStages.planning && planned && planningHigh === 0,
    validation: availableStages.migration && validationTasks.length > 0,
  };
  const nextStage = stageMeta[stageMeta.findIndex((stage) => stage.id === workflowStage) + 1]?.id;
  const handoffTarget = nextStage && readyStages[nextStage] ? nextStage : null;
  const handoffChecks: Record<StageId, string[]> = {
    research: [],
    planning: [`评估资料已核对，迁移范围 ${vmCount} 台`, '评估报告已生成，评估高风险已全部闭环'],
    migration: [`已生成 ${batchTasks.length} 个迁移批次及 RunBook`, '规划高风险已全部闭环，请确认批次与实施窗口'],
    validation: [`已有 ${validationTasks.length} 台虚拟机完成割接并生成配置对比`, '进入后需逐台或批量完成人工验收，不影响其余实施任务'],
  };
  const stages: StageView[] = stageMeta.map((meta) => {
    const steps = stageSteps[meta.id];
    const progress = availableStages[meta.id] ? Math.round(steps.filter((s) => s.state === 'done').length / steps.length * 100) : 0;
    return { ...meta, progress, status: progress === 100 ? 'completed' : project && meta.id === workflowStage ? 'running' : 'pending', actions: [] };
  });

  const active = stages.find((stage) => stage.id === activeStage)!;
  const reportHref = `data:text/plain;charset=utf-8,${encodeURIComponent(`迁移调研评估报告\n项目：${projectName}\n行业：${project?.industry || '—'}\n迁移类型：${project?.migrationType || '—'}\n识别风险：${risks.length} 项\n高风险未闭环：${highRiskOpen.length} 项\n结论：完成高风险闭环后可进入规划设计阶段。`)}`;
  const vmRows = useMemo<(string | number)[][]>(() => Array.from({ length: vmCount }, (_, index) => {
    const number = String(index + 1).padStart(3, '0');
    return [`VM-${index % 3 === 0 ? 'APP' : index % 3 === 1 ? 'DB' : 'WEB'}-${number}`, `10.32.${Math.floor(index / 240) + 10}.${index % 240 + 10}`, index % 4 === 0 ? 8 : 4, index % 4 === 0 ? 32 : 16, index < 42 ? '生产资源池-A' : index < 86 ? '生产资源池-B' : '通用资源池'];
  }), [vmCount]);
  const vmScopeHref = excelHref([{ name: '虚拟机范围', rows: [['虚拟机名称', 'IP 地址', 'vCPU', '内存(GB)', '资源池'], ...vmRows] }]);
  const planningTemplateHref = excelHref([
    { name: '虚拟机清单', rows: [['虚拟机名称', 'IP 地址', '业务系统名称', '业务等级(核心/重要/一般)', '集群类型(主从/RAC集群/单机)', '集群角色(主/从/节点1/节点2)'], ...vmRows.map((row) => [row[0], row[1], '', '', '', ''])] },
    { name: '业务依赖关系', rows: [['源业务系统', '目标业务系统', '依赖类型', '依赖端口', '依赖说明'], ['', '', '', '', '']] },
    { name: '迁移约束条件', rows: [['约束对象', '约束类型', '约束描述', '允许迁移窗口', '回退要求'], ['', '', '', '', '']] },
  ]);
  const planPreview = buildBatchTasks(vmRows.map((row) => String(row[0])));
  const batchPlanHref = excelHref([{ name: '迁移批次与实施计划', rows: [['批次编号', '批次阶段', '虚拟机名称', '阶段类型', '开始日期', '结束日期', '持续天数', '执行负责人', '状态'], ...planPreview.flatMap((batch) => batch.vmNames.map((name) => [batch.id, batch.batchPhase, name, batch.stageType, batch.startDate, batch.endDate, batch.durationDays, '迁移实施组', '待执行']))] }]);
  const runBookHref = `data:text/markdown;charset=utf-8,${encodeURIComponent(`# ${projectName} 迁移 RunBook\n\n## 项目概况\n- 迁移范围：${vmCount} 台虚拟机\n- 迁移类型：${project?.migrationType || '虚拟化'}\n- 计划批次：${planPreview.length} 批\n\n## 执行步骤\n1. 迁移前健康检查与业务停机确认\n2. 创建一致性快照并校验回退点\n3. 按批次执行数据同步与虚拟机迁移\n4. 完成网络、存储及应用连通性验证\n5. 业务负责人签署批次验收记录\n\n## 回退原则\n任一质量门失败时停止后续批次，按原平台快照恢复并重新开放业务。`)}`;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (visible && event.key === 'Escape') { setTransitionReview(null); setPanelValue(null); setNavOpen(false); setCompactInspectorOpen(false); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  });

  useEffect(() => {
    if (!executionStarted) return;
    const timer = window.setInterval(() => {
      setExecutionMetrics((current) => {
        let changed = false;
        const next = { ...current };
        (['creation', 'cutover', 'sync'] as ExecutionTaskKind[]).forEach((kind) => {
          if (!executionApprovals[kind]) return;
          const metric = current[kind];
          if (metric.completed >= metric.total) return;
          const completed = Math.min(metric.total, metric.completed + 1);
          const remaining = metric.total - completed;
          const running = Math.min(2, remaining);
          next[kind] = { ...metric, completed, running, queued: Math.max(0, remaining - running) };
          changed = true;
        });
        return changed ? next : current;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [executionApprovals, executionStarted]);

  useEffect(() => {
    const delivery = window.setTimeout(() => {
      // Shared progress changes never depend on the conversation being viewed.
      const completedCount = Math.min(executionMetrics.cutover.completed, todayCutoverTasks.length);
      if (completedCount > 0) {
        const generated = buildValidationTasks(todayCutoverTasks, batchTasks);
        setValidationTasks((items) => {
          const missing = generated.filter((next) => !items.some((item) => item.id === next.id));
          const added = missing.slice(0, Math.max(0, completedCount - items.length));
          return added.length ? [...items, ...added] : items;
        });
        if (!validationAnnounced.current) {
          validationAnnounced.current = true;
          setToast('已有割接结果，人工确认交接后可进入结果验证');
        }
      }
      (['creation', 'sync', 'cutover'] as ExecutionTaskKind[]).forEach((kind) => {
        const metric = executionMetrics[kind];
        const origin = operationOrigins.current.get(`execute-${kind}`);
        if (!origin || !metric.total || metric.completed < metric.total || executionAnnounced.current.has(kind)) return;
        executionAnnounced.current.add(kind);
        const label = { creation: '新建', sync: '增量同步', cutover: '割接' }[kind];
        setMessages((items) => [...items, { id: Date.now() + Math.random(), role: 'system', text: `${metric.total} 个${label}任务已完成。${kind === 'cutover' ? '配置对比已更新，可在结果验证阶段查看。' : ''}`, time: now(), ...origin, operation: true }]);
      });
      if (executionApprovals.creation) {
        setCreationTasks((items) => items.map((task, index) => index < executionMetrics.creation.completed && task.status !== '已创建' ? { ...task, status: '已创建' } : task));
      }
    }, 100);
    return () => window.clearTimeout(delivery);
  }, [batchTasks, executionMetrics, executionApprovals.creation, todayCutoverTasks]);

  function appendMessage(role: ChatMessage['role'], text: string, target = conversationId, operation = role === 'system', stageOverride?: StageId) {
    const targetStage = stageMeta.find((stage) => stage.id === target)?.id;
    const resolvedTarget = targetStage ? mainConversationId(targetStage) : target;
    setMessages((items) => [...items, { id: Date.now() + Math.random(), role, text, time: now(), conversationId: resolvedTarget, stageId: stageOverride || targetStage || (resolvedTarget.startsWith('chat-') ? undefined : activeStage), operation }]);
  }
  function appendOperation(role: ChatMessage['role'], text: string, target = conversationId, stageOverride?: StageId) {
    appendMessage(role, text, target, true, stageOverride);
  }

  function startNewProject() { setNavOpen(false); onNewProject(); }

  function handleFile(kind: 'rvtools' | 'presales', event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected || assessmentStatus === 'running' || assessmentStatus === 'completed') return;
    const nextFiles = { ...files, [kind]: selected.name };
    setFiles(nextFiles);
    const label = kind === 'rvtools' ? 'RVTools 采集表' : '售前调用表';
    appendOperation('user', `已上传${label}：${selected.name}`);
    if (nextFiles.rvtools && nextFiles.presales) {
      setAssessmentStatus('ready');
      appendMessage('agent', '两份资料已齐全并通过格式检查。请点击左上角“启动评估”，评估子智能体将开始解析。');
    }
  }

  function confirmVmScope() {
    if (!claimOperation('scope', planningStatus === 'scope-review')) return;
    setPlanningStatus('details-pending');
    appendOperation('user', `已确认迁移范围，共 ${vmCount} 台虚拟机。`);
    appendMessage('agent', '范围已锁定。请下载规划信息模板，在“虚拟机清单”中补充业务系统、业务等级、集群类型和集群角色，并完成“业务依赖关系”和“迁移约束条件”两个 Sheet 后上传。');
    setToast('虚拟机范围已确认，请补充规划信息');
  }

  function uploadVmScope(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!claimOperation('scope', planningStatus === 'scope-review')) return;
    setScopeRevisionFile(selected.name);
    setVmCount(124);
    setPlanningStatus('details-pending');
    appendOperation('user', `已上传调整后的虚拟机范围：${selected.name}`);
    appendMessage('agent', '范围列表已刷新：已移除 4 台虚拟机，当前迁移范围为 124 台。请继续下载并填写规划信息模板。');
    setToast('范围已刷新，当前共 124 台虚拟机');
  }

  function uploadPlanningWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    generatePlanning(selected.name);
  }

  function generatePlanning(fileName: string) {
    if (!claimOperation('planning', planningStatus === 'details-pending' && !agentTyping)) return;
    setPlanningWorkbook(fileName);
    setPlanningStatus('generating');
    setAgentTyping(true);
    appendOperation('user', `已上传完整规划信息：${fileName}`);
    appendMessage('system', '规划子智能体正在校验虚拟机业务属性、业务依赖关系和迁移约束条件。');
    window.setTimeout(() => {
      const generatedTasks = buildBatchTasks(vmRows.map((row) => String(row[0])));
      setRisks((items) => [...items.filter((risk) => risk.stage !== 'planning'), ...planningRisks]);
      setBatchTasks(generatedTasks);
      setPlanningStatus('completed');
      setBatchConfirmation('pending');
      setMdStatus('unconfigured');
      setMdHistory([]);
      setExecutionApprovals({ creation: false, cutover: false, sync: false });
      setExecutionStarted(false);
      setExecutionMetrics({ creation: { total: 0, completed: 0, queued: 0, running: 0 }, cutover: { total: 0, completed: 0, queued: 0, running: 0 }, sync: { total: 0, completed: 0, queued: 0, running: 0 } });
      setCreationTasks([]);
      setValidationTasks([]);
  
      setAgentTyping(false);
      appendOperation('agent', `规划设计完成：已生成 ${generatedTasks.length} 项迁移批次任务和 4 项规划风险，其中 1 项高风险需闭环。《迁移批次与实施计划表》和 RunBook 已可下载。`);
      setToast('规划设计完成，已生成风险、批次任务和规划产物');
    }, 1600);
  }

  function startAssessment() {
    if (!project) {
      startNewProject();
      setToast('请先创建项目');
      return;
    }
    if (!files.rvtools || !files.presales) {
      appendMessage('agent', '启动评估前还需要 RVTools 采集表和售前调用表，请先在下方上传。');
      setToast('请先上传两份评估资料');
      return;
    }
    if (assessmentStatus === 'completed') {
      setToast('当前项目已完成评估');
      return;
    }
    if (!claimOperation('assessment', canStartAssessment && !agentTyping)) return;
    setAssessmentStatus('running');
    setAgentTyping(true);
    appendMessage('system', '评估子智能体已启动，正在解析资产清单、容量基线、兼容矩阵和售前约束。');
    window.setTimeout(() => {
      setRisks(initialRisks);
      setAssessmentStatus('completed');
      setAgentTyping(false);
      appendOperation('agent', '评估完成：共识别 4 项风险，其中 2 项为高风险；《迁移调研评估报告》已生成。高风险闭环后方可进入规划设计阶段。');
      setToast('评估完成，已生成风险与评估报告');
    }, 1600);
  }

  function selectStage(target: StageId) {
    if (!project) { setToast('创建项目后自动开启评估会话'); return; }
    if (!availableStages[target]) {
      if (!readyStages[target]) { setToast('请先完成上一阶段的交付条件'); return; }
      setTransitionReview(target);
      conversation.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setTransitionReview(null);
    setTemporaryChat(null);
    setActiveStage(target);
    setManagementPanel(null);
    setNavOpen(false);
  }

  function confirmStageTransition(target: StageId) {
    if (target !== handoffTarget || availableStages[target] || !claimOperation(`enter-${target}`, readyStages[target])) return;
    appendOperation('user', `已人工确认阶段交接，进入${stageName[target]}。`);
    setStageConversations((items) => items.some((chat) => chat.id === mainConversationId(target)) ? items : [...items, createStageConversation(target)]);
    setEnteredStages((items) => [...items, target]);
    setLastStageChats((items) => ({ ...items, [target]: mainConversationId(target) }));
    setTransitionReview(null);
    setTemporaryChat(null); setManagementPanel(null); setNavOpen(false);
    setActiveStage(target);
    appendMessage('system', `${stageName[target]}会话已创建。`, target);
    if (target === 'planning') {
      setPlanningStatus('scope-review');
      appendMessage('agent', '评估交接已确认。请先核对迁移范围，再补充业务属性、依赖关系和迁移窗口。', 'planning');
    } else if (target === 'migration') {
      setBatchConfirmation('confirmed');
      setMdHistory(() => [{ id: Date.now(), time: now(), title: '等待近端 MD 配置', detail: '服务端 23.45.2.2:7839 · 项目 x3ddrnb' }]);
      appendMessage('agent', '规划交接已确认。请在近端 MigrationDirector 配置服务端 IP 23.45.2.2、端口 7839、项目 ID x3ddrnb，再检查连接与配置。', 'migration');
    } else if (target === 'validation') {
      appendMessage('agent', `实施交接已确认。已有 ${validationTasks.length} 台虚拟机进入配置对比，请逐台或批量完成人工验收。阶段切换不影响其余实施任务。`, 'validation');
    }
    setToast(`已确认交接，${stageName[target]}会话已创建`);
  }

  function sendPrompt(text: string) {
    if (!text.trim() || agentTyping || replyLocks.current.has(conversationId)) return;
    replyLocks.current.add(conversationId);
    const target = conversationId;
    if (temporaryChat) setTemporaryChats((items) => items.map((chat) => chat.id === temporaryChat && !messages.some((message) => message.conversationId === temporaryChat && message.role === 'user') ? { ...chat, title: text.trim().slice(0, 22) } : chat));
    if (!temporaryChat && currentStageChat.kind === 'child' && !currentStageChat.manuallyNamed && !messages.some((message) => message.conversationId === target && message.role === 'user' && !message.operation)) setStageConversations((items) => items.map((chat) => chat.id === target ? { ...chat, title: text.trim().slice(0, 22) } : chat));
    appendMessage('user', text.trim(), target);
    setQuestion('');
    setAgentTyping(true);
    window.setTimeout(() => {
      let answer = '';
      if (temporaryChat) answer = `这条讨论会保留在当前临时对话中。${project ? `当前关联项目是「${projectName}」。` : '你可以先梳理迁移需求，准备好后再新建项目。'}\n\n${/风险/.test(text) ? '建议先确认业务停机窗口、源端与目标端兼容性，以及可验证的回退方案。' : '可以先补充源端平台、资产数量和业务约束，便于明确接下来的准备工作。'}${project ? '需要推进交付时，可切回左侧阶段会话。' : ''}`;
      else if (!project) answer = '先建立项目吧。填写局点、代表处和迁移类型后，我会帮你整理评估资料。';
      else if (batchConfirmation === 'adjusting' && planned && adjustmentOwner.current === target) {
        answer = '收到你的批次调整说明。当前演示保留已有的 8 个批次；正式执行前，需要核对每一批的业务依赖和停机窗口。你可以先查看批次清单，再确认是否进入实施。';
        setBatchConfirmation((current) => current === 'adjusting' ? 'pending' : current);
        adjustmentOwner.current = null;
      } else if (/风险|兼容/.test(text)) answer = assessed ? `目前记录了 ${risks.length} 项风险，其中 ${highRiskOpen.length} 项高风险尚未闭环。\n\n优先检查 CPU 兼容性和业务性能基线。请在风险清单中记录处理措施与验证依据，完成高风险闭环后，我会引导你进入下一阶段。` : '我会重点核对 CPU 指令集兼容性、峰值 IOPS、网络与存储映射。评估完成后，每项风险都会标注等级和影响范围，高风险需要人工闭环。';
      else if (/资料|文件|采集|上传/.test(text)) answer = '调研评估需要 RVTools 采集表和售前调用表，支持 XLSX、XLS、CSV。前者用于核对资产和资源，后者用于确认业务基线与迁移约束。\n\n也可以直接使用示例资料；选择本地文件时只记录文件名，不会上传到服务器。';
      else if (/报告|产物|交付件/.test(text)) answer = assessed ? `评估报告已就绪，右侧“文件与产物”可以直接下载。${planned ? '批次计划和 RunBook 也已生成。' : '完成规划信息后，还会生成批次计划和 RunBook。'}所有文件都可以在左侧“迁移交付件”中查看。` : '评估完成后，我会生成风险清单与评估报告；规划完成后再输出批次计划和 RunBook。当前可以先确认输入资料并启动评估。';
      else if (/范围|多少|概况/.test(text)) answer = `当前项目为「${projectName}」，属于${project.industry}行业、${project.office}，迁移类型为${project.migrationType}。示例范围包含 ${vmCount} 台虚拟机。\n\n进入规划阶段后，可以下载范围清单并确认需要迁移的资产。`;
      else if (/下一步|进度|当前|待办/.test(text)) answer = ({ research: assessed ? '评估结果已生成。下一步请查看风险清单，关闭未处理的高风险，再确认迁移范围。' : (files.rvtools && files.presales ? '资料已准备好。下一步启动评估，我会核对资产清单和兼容性，并把进度同步到右侧。' : '请先准备 RVTools 采集表和售前调用表，也可以使用示例资料，再启动评估。'), planning: planned ? '计划已经生成。请先闭环规划高风险，再确认批次和实施窗口。' : '先确认虚拟机范围，再补充业务属性、依赖关系和迁移约束。我会据此展示分批实施计划。', migration: mdStatus === 'ready' ? 'MD 检查已通过。新建、割接、增量同步可以分别查看并确认，已确认的任务会独立执行。' : '先检查近端 MD 的连接、源端发现、目标资源和端口组映射。全部通过后再确认实施任务。', validation: `已经有 ${validationTasks.length} 台虚拟机进入验证，${confirmedValidationCount} 台已确认。请逐项查看配置对比并完成人工验收。` })[activeStage];
      else answer = ({ research: '我会先整理资产范围与兼容性风险。你可以继续补充源端平台、业务高峰时间或特殊约束，也可以先使用示例资料完成一次评估。', planning: '规划时需要重点确认业务分级、集群关系和允许迁移窗口。请把这些信息补充到规划模板中，再生成批次。', migration: '实施任务按类别分别确认。你可以打开任务清单查看目标配置、同步窗口和割接状态；最终执行前仍需要你的确认。', validation: '验收分为配置对比与人工确认两步。当前演示展示 25 项源端和目标端配置，确认一致后再标记虚拟机迁移完成。' })[activeStage];
      appendMessage('agent', answer, target);
      replyLocks.current.delete(target);
      setAgentTyping(false);
    }, 550);
  }

  function submitQuestion(event: FormEvent) { event.preventDefault(); sendPrompt(question); }

  function requestBatchAdjustment() {
    if (!planned || batchConfirmation === 'confirmed') { setToast('请先完成规划，已确认的批次不能重复调整'); return; }
    setBatchConfirmation('adjusting');
    adjustmentOwner.current = conversationId;
    setQuestion('请调整批次：');
    appendMessage('agent', '请直接在输入框中说明需要调整的批次编号、虚拟机范围、阶段类型或日期，我会重新计算批次计划。');
    window.setTimeout(() => composer.current?.focus(), 0);
  }

  function confirmBatchesAndPrepareMigration() {
    const blockers = risks.filter((risk) => risk.stage === 'planning' && risk.level === '高' && !risk.closed);
    if (blockers.length) {
      setToast(`规划设计仍有 ${blockers.length} 项高风险未闭环`);
      setPanel('risk');
      return;
    }
    if (!planned || availableStages.migration) return;
    setTransitionReview('migration');
    conversation.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startMdCheck() {
    if (!claimOperation('md-check', batchConfirmation === 'confirmed' && mdStatus === 'unconfigured' && !agentTyping)) return;
    setMdStatus('checking-connection');
    setMdHistory((items) => [...items, { id: Date.now(), time: now(), title: '开始检查服务端连接', detail: '23.45.2.2:7839 · 项目 x3ddrnb' }]);
    setAgentTyping(true);
    appendMessage('system', '正在检查近端 MigrationDirector 与服务端的连接状态。');
    window.setTimeout(() => {
      setMdStatus('connected');
      setMdHistory((items) => [...items, { id: Date.now() + 1, time: now(), title: '近端 MigrationDirector 连接成功', detail: '心跳与项目身份校验正常' }]);
      appendMessage('agent', '近端 MigrationDirector 已成功连接。正在检查源端 VMware、目标端 FusionCompute 的发现配置及端口组映射。');
      window.setTimeout(() => {
        setMdStatus('checking-config');
        setMdHistory((items) => [...items, { id: Date.now() + 2, time: now(), title: '源端 VMware 检查通过', detail: '保护源与虚拟机发现状态正常' }, { id: Date.now() + 3, time: now(), title: '目标端 FusionCompute 检查通过', detail: '目标资源池与保护配置正常' }, { id: Date.now() + 4, time: now(), title: '端口组映射检查通过', detail: '源端与目标端网络映射完整' }]);
        window.setTimeout(() => {
          const tasks = buildCreationTasks(batchTasks);
          setMdStatus('ready');
          setMdHistory((items) => [...items, { id: Date.now() + 5, time: now(), title: 'MigrationDirector 已就绪', detail: '进入三类实施任务人工确认阶段' }]);
          setCreationTasks(tasks);
          setExecutionMetrics({ creation: { total: tasks.length, completed: 0, queued: tasks.length, running: 0 }, cutover: { total: todayCutoverTasks.length, completed: 0, queued: todayCutoverTasks.length, running: 0 }, sync: { total: 8, completed: 0, queued: 8, running: 0 } });
          setAgentTyping(false);
          appendOperation('agent', `配置检查全部通过，MigrationDirector 已就绪。实施前需要逐项确认：是否可以执行 ${tasks.length} 个待新建任务？`);
          setToast('MigrationDirector 检查通过，请确认三类实施任务');
        }, 850);
      }, 450);
    }, 900);
  }

  function confirmExecutionType(kind: ExecutionTaskKind) {
    if (!claimOperation(`execute-${kind}`, mdStatus === 'ready' && !executionApprovals[kind] && executionMetrics[kind].total > executionMetrics[kind].completed)) return;
    const labels: Record<ExecutionTaskKind, string> = { creation: '待新建任务', cutover: '待割接任务', sync: '待增量同步任务' };
    const next = { ...executionApprovals, [kind]: true };
    setExecutionApprovals(next);
    appendOperation('user', `已查看并确认${labels[kind]}可以实施。`);
    setExecutionStarted(true);
    setExecutionMetrics((current) => {
      const start = (metric: ExecutionMetric) => { const remaining = metric.total - metric.completed; const running = Math.min(2, remaining); return { ...metric, running, queued: Math.max(0, remaining - running) }; };
      return { ...current, [kind]: start(current[kind]) };
    });
    const remaining = (['creation', 'cutover', 'sync'] as ExecutionTaskKind[]).filter((item) => !next[item]);
    appendMessage('agent', `${labels[kind]}已独立启动执行。${remaining.length ? `其余 ${remaining.length} 类任务可在查看无误后分别确认，不影响当前队列运行。` : '三类任务均已确认并进入执行。'}`);
    setToast(`${labels[kind]}已确认并开始执行`);
  }

  function openExecutionTaskPanel(kind: ExecutionTaskKind) {
    setPanel(kind === 'creation' ? 'creation' : kind === 'cutover' ? 'cutover' : 'sync');
  }

  function updateCreationTasks(next: CreationTask[]) {
    if (mdStatus !== 'ready' || executionApprovals.creation || operationOrigins.current.has('execute-creation')) { setToast('任务正在执行或已经完成，配置已锁定'); return; }
    const changed = next.filter((task) => {
      const current = creationTasks.find((item) => item.id === task.id);
      return current && current.status !== '已创建' && JSON.stringify(current) !== JSON.stringify(task);
    });
    if (!changed.length) return;
    const creating = changed.some((task) => task.status === '已创建');
    if (creating && !claimOperation('execute-creation', creationTasks.every((task) => task.status !== '待配置'))) return;
    setCreationTasks((items) => items.map((task) => changed.find((item) => item.id === task.id) || task));
    appendOperation('user', `已${creating ? '创建' : '确认配置'} ${changed.length} 个迁移任务。`);
    if (creating) {
      setExecutionApprovals((items) => ({ ...items, creation: true }));
      setExecutionMetrics((items) => ({ ...items, creation: { total: next.length, completed: next.length, queued: 0, running: 0 } }));
    }
  }

  function completeCutoverTasks(taskIds: string[]) {
    if (mdStatus !== 'ready' || executionApprovals.cutover) { setToast('割接任务正在执行或尚未满足前置条件'); return; }
    const completedTasks = todayCutoverTasks.filter((task) => taskIds.includes(task.id) && !validationTasks.some((item) => item.id === `VAL-${task.id}`) && !operationOrigins.current.has(`cutover-${task.id}`));
    if (!completedTasks.length) { setToast('所选任务已完成，请勿重复提交'); return; }
    completedTasks.forEach((task) => claimOperation(`cutover-${task.id}`));
    const generated = buildValidationTasks(todayCutoverTasks, batchTasks).filter((task) => completedTasks.some((item) => task.id === `VAL-${item.id}`));
    setValidationTasks((items) => [...items, ...generated.filter((next) => !items.some((item) => item.id === next.id))]);
    setExecutionMetrics((items) => {
      const completed = Math.min(items.cutover.total, items.cutover.completed + generated.length);
      return { ...items, cutover: { ...items.cutover, completed, queued: items.cutover.total - completed, running: 0 } };
    });
    appendOperation('system', `${completedTasks.length} 台虚拟机已确认割接完成，验证任务已生成。`);
    setToast(`已生成 ${generated.length} 个验证任务，确认阶段交接后可进入结果验证`);
  }

  function confirmValidationTasks(ids: string[]) {
    const confirmed = validationTasks.filter((task) => ids.includes(task.id) && task.comparison === '一致' && !task.confirmed && !operationOrigins.current.has(`validate-${task.id}`));
    if (!confirmed.length) return;
    confirmed.forEach((task) => claimOperation(`validate-${task.id}`));
    setValidationTasks((items) => items.map((task) => ids.includes(task.id) && task.comparison === '一致' ? { ...task, confirmed: true } : task));
    appendOperation('user', `已核对配置，确认 ${confirmed.length} 台虚拟机验收通过。`);
    appendMessage('agent', `已保存这 ${confirmed.length} 台虚拟机的验收结果。${confirmedValidationCount + confirmed.length === validationTasks.length ? '本轮验证已全部完成。批次完成情况已同步到右侧，其余规划批次可继续在迁移任务中查看。' : `本轮还有 ${validationTasks.length - confirmedValidationCount - confirmed.length} 台待确认，可以继续检查配置对比。`}`);
    setToast(`已保存 ${confirmed.length} 台虚拟机的验收结果`);
  }

  function confirmValidationTask(id: string) { confirmValidationTasks([id]); }


  function closeRisk(id: number, closureDescription: string) {
    const riskBeingClosed = risks.find((risk) => risk.id === id);
    if (!riskBeingClosed || riskBeingClosed.closed || !closureDescription.trim() || !claimOperation(`risk-${id}`)) return;
    const remainingStageHighRisks = risks.filter((risk) => risk.stage === riskBeingClosed?.stage && risk.level === '高' && !risk.closed && risk.id !== id);
    setRisks((items) => items.map((risk) => risk.id === id ? { ...risk, closed: true, closedAt: new Date().toLocaleString('zh-CN', { hour12: false }), closureDescription } : risk));
    appendOperation('system', `风险 R-${String(id).padStart(3, '0')} 已人工确认闭环。`);
    if (riskBeingClosed?.stage === 'research' && riskBeingClosed.level === '高' && remainingStageHighRisks.length === 0) {
      appendMessage('agent', '评估高风险已全部闭环。请查看阶段交接，人工确认后开启规划设计会话。');
      setToast('评估交付条件已满足，等待人工确认阶段交接');
    } else if (riskBeingClosed?.stage === 'planning' && riskBeingClosed.level === '高' && remainingStageHighRisks.length === 0) {
      appendMessage('agent', '规划高风险已全部闭环。请确认批次与实施窗口，再人工确认阶段交接。');
      setToast('规划交付条件已满足，等待人工确认阶段交接');
    } else {
      setToast('风险已闭环，阶段门状态已更新');
    }
  }

  const panelNames: Record<Exclude<PanelId, null>, string> = { risk: '迁移风险', tasks: '迁移任务', creation: '新建任务配置', cutover: '割接任务', sync: '增量同步', validation: '验证与验收', deliverables: '迁移交付件', logs: '操作日志' };

  function setPanel(next: PanelId) {
    setTransitionReview(null);
    setPanelValue(next);
    setNavOpen(false);
    if (next) {
      setTemporaryChat(null);
      if (['tasks', 'risk', 'deliverables', 'logs'].includes(next)) return;
      appendMessage('agent', ({ risk: '我把风险清单放在下方。先处理高风险，记录措施和验证依据后再闭环。', tasks: '下面是当前迁移批次与任务。可以按阶段筛选，也可以查看每个批次中的虚拟机。', creation: '请核对源端信息和目的 VM 配置。每个任务都确认后，再批量创建。', cutover: '下面是本次割接清单。核对同步状态和实施窗口，割接完成后进入配置验证。', sync: '这里可以查看增量同步的源端快照、目标地址和任务进展。', validation: '源端与目标端的配置对比已经整理好了。确认无误后，请完成人工验收。', deliverables: '这里汇总当前项目已经生成的交付件，后续阶段的产物也会自动加入。', logs: '这里记录项目创建、任务执行与人工确认等操作。' })[next]);
    }
  }

  function useDemoFiles() {
    if (assessmentStatus === 'running' || assessmentStatus === 'completed') { setToast('评估正在执行或已经完成，当前资料已锁定'); return; }
    setFiles({ rvtools: 'RVTools-示例资产.xlsx', presales: '售前调用表-示例.xlsx' });
    setAssessmentStatus('ready');
    appendOperation('agent', '两份示例资料已就绪。点击“启动评估子智能体”，开始核对资产与兼容性。');
  }

  function useDemoPlanning() { generatePlanning('迁移规划信息-示例.xlsx'); }

  const lastMessageView = useRef({ count: visibleMessages.length, id: conversationId });
  useEffect(() => {
    if (visibleMessages.length === lastMessageView.current.count && conversationId === lastMessageView.current.id) return;
    lastMessageView.current = { count: visibleMessages.length, id: conversationId };
    const frame = requestAnimationFrame(() => {
      if (panel) inlineWork.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else conversation.current?.scrollTo({ top: conversation.current.scrollHeight, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [visibleMessages.length, conversationId, panel]);

  const open = (label: string, description: string, value: PanelId) => ({ label, description, onClick: () => value === null ? showStageWork() : setPanel(value) });
  const quickGroups: Record<StageId, QuickGroup[]> = {
    research: [
      { label: '资料准备', icon: 'folder', options: [{ label: '评估需要哪些资料？', description: '了解采集表与售前信息', onClick: () => sendPrompt('评估需要哪些资料？') }, { label: '查看评估资料', description: '确认或替换当前输入文件', onClick: showStageWork }] },
      { label: '风险与报告', icon: 'shield', options: [{ label: '有哪些兼容性风险？', description: '了解评估的重点检查项', onClick: () => sendPrompt('有哪些兼容性风险？') }, open('查看交付风险', '查询并处理当前风险', 'risk'), { label: '有哪些报告可以下载？', description: '查看当前阶段产物', onClick: () => sendPrompt('有哪些报告可以下载？') }] },
      { label: '项目概况', icon: 'chat', options: [{ label: '总结当前项目范围', description: '虚拟机数量与业务背景', onClick: () => sendPrompt('总结当前项目范围') }, { label: '告诉我下一步该做什么', description: '梳理当前阶段的待办', onClick: () => sendPrompt('告诉我下一步该做什么') }] },
    ],
    planning: [
      { label: '范围与依赖', icon: 'folder', options: [{ label: '查看规划工作台', description: '确认范围、填写资料或生成批次', onClick: showStageWork }, { label: '总结当前迁移范围', description: '查看需要迁移的资产', onClick: () => sendPrompt('总结当前迁移范围') }, { label: '如何填写业务依赖？', description: '业务分级、集群与上下游关系', onClick: () => sendPrompt('如何填写业务依赖？') }] },
      { label: '批次计划', icon: 'tasks', options: [open('查看迁移批次', '查看计划与甘特图', 'tasks'), { label: '调整迁移批次', description: '说明要调整的资产或日期', onClick: requestBatchAdjustment }] },
      { label: '风险与产物', icon: 'file', options: [open('查看规划风险', '处理进入实施前的风险', 'risk'), { label: '有哪些规划产物？', description: '批次计划和 RunBook', onClick: () => sendPrompt('有哪些规划产物？') }] },
    ],
    migration: [
      { label: '环境检查', icon: 'search', options: [{ label: '当前 MD 配置与进度', description: '连接状态和实施准备', onClick: () => sendPrompt('当前 MD 配置与进度') }, { label: '查看实施工作台', description: '回到连接检查与任务确认', onClick: showStageWork }] },
      { label: '实施任务', icon: 'tasks', options: [open('配置新建任务', '确认目的 VM 与网络', mdStatus === 'ready' ? 'creation' : null), open('查看割接任务', '检查割接清单和任务状态', mdStatus === 'ready' ? 'cutover' : null), open('查看增量同步', '源端快照与同步窗口', mdStatus === 'ready' ? 'sync' : null)] },
      { label: '进展与报告', icon: 'file', options: [{ label: '总结当前实施进度', description: '查看各类任务的执行进展', onClick: () => sendPrompt('总结当前实施进度') }, open('查看交付件', '查看评估报告与实施文档', 'deliverables')] },
    ],
    validation: [
      { label: '配置对比', icon: 'search', options: [open('查看验证结果', '检查 25 项源端与目标端配置', 'validation'), { label: '如何核对验证结果？', description: '了解对比范围与人工验收', onClick: () => sendPrompt('如何核对验证结果？') }] },
      { label: '人工验收', icon: 'tasks', options: [open('查看待确认虚拟机', '逐台或批量确认迁移结果', 'validation'), { label: '当前验收进度如何？', description: '查看已确认与待确认数量', onClick: () => sendPrompt('当前验收进度如何？') }] },
      { label: '交付产物', icon: 'file', options: [open('查看交付件', '查看全部项目交付文件', 'deliverables'), open('查看批次完成情况', '查看已验收的迁移批次', 'tasks')] },
    ],
  };
  const currentSteps = stageSteps[activeStage];
  const currentStatus = currentSteps.some((s) => s.state === 'blocked') ? '等待人工确认' : runningStages[activeStage] ? '正在处理' : active.progress === 100 ? '阶段已完成' : activeStage === 'research' && assessmentStatus === 'ready' ? '资料就绪，等待启动' : '等待下一步';
  const overallProgress = Math.round(stages.reduce((sum, stage) => sum + stage.progress, 0) / 4);
  const totalMetrics = Object.values(executionMetrics).reduce((sum, item) => sum + item.total, 0);
  const finishedMetrics = Object.values(executionMetrics).reduce((sum, item) => sum + item.completed, 0);
  const stageStats = ({
    research: [{ label: '迁移范围', tone: 'info', value: assessed ? `${vmCount} 台虚拟机` : '待评估' }, { label: '输入资料', tone: 'info', value: `${Number(Boolean(files.rvtools)) + Number(Boolean(files.presales))} / 2 份` }, { label: '识别风险', tone: 'warning', value: assessed ? `${risks.filter((r) => r.stage === 'research').length} 项` : '待评估' }, { label: '待闭环高风险', tone: 'warning', value: assessed ? `${researchHigh} 项` : '待评估' }],
    planning: [{ label: '迁移范围', tone: 'info', value: planningStatus === 'scope-review' ? `${vmCount} 台 · 待确认` : `${vmCount} 台 · 已确认` }, { label: '迁移批次', tone: 'info', value: `${batchTasks.length} 批` }, { label: '规划高风险', tone: 'warning', value: `${planningHigh} 项待闭环` }, { label: '批次确认', tone: 'brand', value: batchConfirmation === 'confirmed' ? '已确认' : '待确认' }],
    migration: [{ label: '新建任务', tone: 'brand', value: `${executionMetrics.creation.completed} / ${executionMetrics.creation.total}` }, { label: '增量同步', tone: 'brand', value: `${executionMetrics.sync.completed} / ${executionMetrics.sync.total}` }, { label: '割接任务', tone: 'brand', value: `${executionMetrics.cutover.completed} / ${executionMetrics.cutover.total}` }, { label: '总完成率', tone: 'success', value: `${totalMetrics ? Math.round(finishedMetrics / totalMetrics * 100) : 0}%` }],
    validation: [{ label: '进入验证', tone: 'info', value: `${validationTasks.length} 台` }, { label: '配置一致', tone: 'success', value: `${validationTasks.filter((t) => t.comparison === '一致').length} 台` }, { label: '人工确认', tone: 'success', value: `${confirmedValidationCount} 台` }, { label: '完成批次', tone: 'success', value: `${completedBatchIds.length} 批` }],
  })[activeStage];
  const artifacts = [
    ...(activeStage === 'research' && files.rvtools ? [{ label: 'RVTools 采集表', meta: '输入资料 · XLSX', onClick: () => { setPanel(null); setToast(files.rvtools); } }] : []),
    ...(activeStage === 'research' && files.presales ? [{ label: '售前调用表', meta: '输入资料 · XLSX', onClick: () => { setPanel(null); setToast(files.presales); } }] : []),
    ...(assessed ? [{ label: '调研评估报告', meta: '评估产物 · TXT', href: reportHref, download: `${projectName}-评估报告.txt` }] : []),
    ...(planned ? [{ label: '迁移批次计划', meta: `${batchTasks.length} 批 · XLS`, href: batchPlanHref, download: `${projectName}-批次计划.xls` }, { label: '迁移 RunBook', meta: '实施手册 · Markdown', href: runBookHref, download: `${projectName}-RunBook.md` }] : []),
  ];

  return (
    <main className={`workspace ${navOpen ? 'nav-open' : ''} ${navCollapsed ? 'nav-collapsed' : ''} ${showInspector ? '' : 'inspector-collapsed'} ${isManagement ? 'management-view' : ''}`}>
      <a href={`#conversation-${projectId}`} className="skip-link">跳转到对话</a>
      {navOpen && <button className="nav-scrim" aria-label="关闭导航" onClick={() => setNavOpen(false)} />}
      <aside className="nav-rail" aria-label="折叠导航">
        <button ref={expandNavButton} className="icon-button" aria-label="展开左侧菜单" title="展开左侧菜单" aria-expanded={false} aria-controls={`project-navigation-${projectId}`} onClick={() => toggleNavigation(false)}><Icon name="sidebar" size={19} /></button>
        <button className="icon-button" aria-label="新建项目" title="新建项目" onClick={startNewProject}><Icon name="plus" size={19} /></button>
        <button className="icon-button" aria-label="新建聊天" title="新建聊天" onClick={newChat}><Icon name="chat" size={19} /></button>
        <button className="icon-button nav-rail-account" aria-label="展开用户与外观设置" title="用户与外观" onClick={() => toggleNavigation(false)}><Icon name="user" size={19} /></button>
      </aside>
      <aside className="workspace-nav" id={`project-navigation-${projectId}`} aria-label="项目导航">
        <div className="nav-platform"><span className="huawei-symbol" role="img" aria-label="华为" /><h1>MigrationDirector <span>Plus</span></h1><button ref={collapseNavButton} className="icon-button nav-collapse" aria-label="折叠左侧菜单" title="折叠左侧菜单" aria-expanded={true} aria-controls={`project-navigation-${projectId}`} onClick={() => toggleNavigation(true)}><Icon name="sidebar" size={17} /></button><button className="icon-button nav-close" aria-label="收起导航" onClick={() => setNavOpen(false)}><Icon name="close" size={16} /></button></div>
        <div className="project-switcher-row"><div className="project-switcher"><Icon name="folder" size={18} /><select aria-label="切换当前项目" title={project ? projectName : '工作空间'} value={projectId} onChange={(e) => onSelectProject(e.target.value)}><option value="lobby">工作空间</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.info.siteName}</option>)}</select><Icon name="chevron" size={13} /></div><button className="icon-button" title="新建项目" aria-label="新建项目" onClick={startNewProject}><Icon name="plus" size={18} /></button><button className="icon-button" title="新建聊天" aria-label="新建聊天" onClick={newChat}><Icon name="chat" size={18} /></button></div>
        <div className="nav-tree-scroll">
          <nav className="primary-nav project-resources" aria-label="项目资料">
            {([{ id: 'tasks', label: '迁移任务', icon: 'tasks' }, { id: 'risk', label: '迁移风险', icon: 'shield' }, { id: 'deliverables', label: '迁移交付件', icon: 'file' }, { id: 'logs', label: '操作日志', icon: 'clock' }] as const).map((item) => <button key={item.id} className={panel === item.id ? 'selected' : ''} disabled={!project} onClick={() => setPanel(item.id)}><Icon name={item.icon} size={17} /><span>{item.label}</span>{item.id === 'risk' && risks.some((risk) => !risk.closed) && <span className="nav-count">{risks.filter((risk) => !risk.closed).length}</span>}</button>)}
          </nav>
          <StageConversationList title={active.title} conversations={stageConversations} selectedId={!temporaryChat && !isManagement ? conversationId : null} disabled={!project} busyIds={Object.entries(conversationViews).filter(([, item]) => item.typing).map(([id]) => id)} onCreate={newStageChat} onSelect={openStageChat} onRename={renameStageChat} />
          <section className="nav-section"><div className="nav-section-heading"><h2>临时对话</h2><button className="icon-button" aria-label="添加临时对话" onClick={newChat}><Icon name="plus" size={15} /></button></div><nav className="temporary-conversations" aria-label="临时对话">{temporaryChats.map((chat) => <button key={chat.id} title={chat.title} className={temporaryChat === chat.id ? 'selected' : ''} onClick={() => openChat(chat.id)}><Icon name="chat" size={15} /><span>{chat.title}</span></button>)}</nav>{!temporaryChats.length && <p className="nav-empty">随时开启一段讨论</p>}</section>
        </div>
        <div className="nav-bottom"><div className="user-profile" aria-label="当前用户"><span><Icon name="user" size={17} /></span><div><strong>当前用户</strong><small>个人账户</small></div></div><ThemePicker /></div>
      </aside>
      <section className="conversation-workspace">
        <div className="mobile-workspace-bar"><button className="icon-button" aria-label="打开导航" onClick={() => setNavOpen(true)}><Icon name="menu" /></button><span>{project ? projectName : '工作空间'}</span></div>
        {showStageRail && <section className="progress-rail" aria-label="迁移项目进度"><div className="progress-caption"><span>项目流程</span><span><strong>{overallProgress}%</strong> 本轮进度 · {stages.filter((s) => s.status === 'completed').length} / 4 阶段完成</span></div><ol>{stages.map((stage, index) => <li key={stage.id} className={`${project && stage.id === workflowStage ? 'current' : ''} ${stage.status === 'completed' ? 'done' : ''} ${runningStages[stage.id] ? 'is-processing' : ''} ${project && activeStage === stage.id ? 'viewed-stage' : ''}`}><button disabled={!availableStages[stage.id] && !readyStages[stage.id]} onClick={() => selectStage(stage.id)} aria-current={project && stage.id === activeStage ? 'step' : undefined}><span className="stage-sequence">{stage.status === 'completed' ? <Icon name="check" size={12} /> : index + 1}</span><span>{stage.title}</span><small>{!availableStages[stage.id] && readyStages[stage.id] ? '待确认' : `${stage.progress}%`}</small></button><div className="stage-track" role="progressbar" aria-label={`${stage.title}进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stage.progress}><i style={{ width: `${stage.progress}%` }} /></div></li>)}</ol></section>}
        {!isManagement && <div className="conversation-toolbar"><div className="conversation-context"><Icon name={temporaryChat ? 'chat' : 'agent'} size={15} /><span>{temporaryChat ? temporaryChats.find((chat) => chat.id === temporaryChat)?.title : project ? (currentStageChat.title === active.title ? active.title : `${active.title} / ${currentStageChat.title}`) : '准备开始'}</span></div>{temporaryChat && <span className="conversation-context-note">独立讨论</span>}{project && !temporaryChat && !showInspector && <button className="show-execution-details" onClick={toggleInspector}><Icon name="tasks" size={14} />查看执行详情</button>}</div>}
        <div className="conversation-scroll" ref={conversation} id={`conversation-${projectId}`} tabIndex={-1}>
          <div className={`conversation-content ${panel ? 'has-inline-panel' : ''}`}>
            {!isManagement && (project || temporaryChat) && <div className="conversation-date"><span>今天</span><span>·</span><span>{temporaryChat ? '临时对话' : '项目协作'}</span></div>}
            {project && !temporaryChat && !isManagement && handoffTarget && <StageHandoff from={stageName[workflowStage]} to={stageName[handoffTarget]} checks={handoffChecks[handoffTarget]} reviewing={transitionReview === handoffTarget} onReview={() => setTransitionReview(handoffTarget)} onCancel={() => setTransitionReview(null)} onConfirm={() => confirmStageTransition(handoffTarget)} />}
            {!isManagement && <div className="message-history" role="log" aria-label="迁移对话记录" aria-live="polite">{visibleMessages.map((message) => <article className={`message message-${message.role}`} key={message.id}>{message.role === 'agent' && <div className="message-author"><Icon name="agent" size={14} /><time>{message.time}</time></div>}{message.role === 'system' ? <p className="system-event"><Icon name="check" size={13} />{message.text}</p> : <div className="message-body"><p>{message.text}</p></div>}</article>)}</div>}
            {(!project && !temporaryChat) && <div className="workspace-welcome"><Icon name="brand" size={32} /><h2>从这里开始迁移交付</h2><p>创建项目，按四个阶段推进。<br />也可以先开一段聊天，理清思路。</p><div><button className="primary" onClick={startNewProject}><Icon name="plus" size={17} />新建项目</button><button onClick={newChat}><Icon name="chat" size={17} />新建聊天</button></div></div>}
            {temporaryChat && !visibleMessages.length && <div className="workspace-welcome chat-welcome"><Icon name="chat" size={28} /><h2>这次想讨论什么？</h2><p>{project ? `这段对话关联「${projectName}」。` : '可以先讨论迁移需求，再创建项目。'}<br />讨论内容会单独保留。</p></div>}
            {project && !temporaryChat && <div className="inline-work" ref={inlineWork} key={conversationId}>
              {panel ? <section className={isManagement ? 'management-surface' : 'inline-artifact'} aria-label={isManagement ? panelNames[panel] : `对话中的${panelNames[panel]}`}>{!isManagement && <div className="inline-artifact-label"><span><Icon name="file" size={15} />{panelNames[panel]}</span><button onClick={() => setPanel(null)}><Icon name="close" size={14} />收起</button></div>}
                {panel === 'deliverables' && <div className="project-records"><h2>迁移交付件</h2><p>各阶段生成的文件统一归档在这里。</p>{artifacts.filter((item) => 'href' in item).length ? artifacts.filter((item) => 'href' in item).map((item) => <a className="deliverable-row" key={item.label} href={'href' in item ? item.href : undefined} download={'download' in item ? item.download : undefined}><Icon name="file" /><span><strong>{item.label}</strong><small>{item.meta}</small></span><Icon name="download" size={17} /></a>) : <div className="records-empty">还没有交付件。完成评估后，首份报告会出现在这里。</div>}</div>}
                {panel === 'logs' && <div className="project-records"><h2>操作日志</h2><p>当前项目的执行事件与人工操作记录。</p><ol className="operation-log">{messages.filter((message) => message.operation).map((message) => <li key={message.id}><time>{message.time}</time><div><small>{message.stageId ? stageName[message.stageId] : '项目操作'} · {stageConversations.find((chat) => chat.id === message.conversationId)?.title || '项目会话'}</small><p>{message.text}</p></div></li>)}</ol></div>}
                {panel === 'risk' && <RiskPanel projectId={projectId} risks={risks} projectExists={Boolean(project)} onClose={() => setPanel(null)} onCloseRisk={closeRisk} />}
                {panel === 'tasks' && <TaskPanel projectId={projectId} batches={batchTasks} creationTasks={creationTasks} risks={risks} completedBatchIds={completedBatchIds} projectExists={Boolean(project)} onClose={() => setPanel(null)} onNotify={setToast} />}
                {panel === 'creation' && <CreationTaskPanel tasks={creationTasks} locked={executionApprovals.creation} onChange={updateCreationTasks} onClose={() => setPanel(null)} onNotify={setToast} />}
                {panel === 'cutover' && <CutoverTaskPanel tasks={todayCutoverTasks} completedIds={validationTasks.map((task) => task.id.slice(4))} running={executionApprovals.cutover && executionMetrics.cutover.completed < executionMetrics.cutover.total} onComplete={completeCutoverTasks} onClose={() => setPanel(null)} onNotify={setToast} />}
                {panel === 'sync' && <SyncTaskPanel batches={batchTasks} total={executionMetrics.sync.total} completed={executionMetrics.sync.completed} onClose={() => setPanel(null)} />}
                {panel === 'validation' && <ValidationPanel tasks={validationTasks} completedBatchIds={completedBatchIds} onConfirm={confirmValidationTask} onConfirmBatch={confirmValidationTasks} onClose={() => setPanel(null)} />}
              </section> : showWorkflow ? <div className="workflow-embeds">
              {currentStageChat.kind === 'child' && <div className="stage-work-heading"><span>阶段操作 · 项目共享</span><button onClick={() => updateConversationView({ workOpen: false })}>收起</button></div>}
            {project && activeStage === 'research' && assessmentStatus !== 'completed' && (
              <div className="upload-card">
                <div className="upload-card-copy"><small>ASSESSMENT INPUTS</small><h3><Icon name="file" size={16} />上传调研评估资料</h3><p>支持 XLSX、XLS、CSV，可使用示例资料。</p></div>
                <div className="upload-items">
                  <label className={files.rvtools ? 'uploaded' : ''}><input type="file" accept=".xlsx,.xls,.csv" disabled={assessmentStatus === 'running'} onChange={(event) => handleFile('rvtools', event)} /><span><Icon name="file" size={17} /></span><div><strong>RVTools 采集表</strong><small>{files.rvtools || '支持 XLSX / XLS / CSV'}</small></div><em>{files.rvtools ? '已就绪 ✓' : '选择文件'}</em></label>
                  <label className={files.presales ? 'uploaded' : ''}><input type="file" accept=".xlsx,.xls,.csv" disabled={assessmentStatus === 'running'} onChange={(event) => handleFile('presales', event)} /><span><Icon name="file" size={17} /></span><div><strong>售前调用表</strong><small>{files.presales || '支持 XLSX / XLS / CSV'}</small></div><em>{files.presales ? '已就绪 ✓' : '选择文件'}</em></label>
                </div>
                <button className="sample-files" disabled={assessmentStatus === 'running'} onClick={useDemoFiles}>使用示例资料</button><button className="inline-assess" disabled={!canStartAssessment} onClick={startAssessment}>{assessmentStatus === 'running' ? '评估子智能体正在分析…' : '启动评估子智能体'}</button>
              </div>
            )}

            {assessmentStatus === 'completed' && activeStage === 'research' && (
              <div className="assessment-result">
                <span>!</span><div className="assessment-result-copy"><small>ASSESSMENT COMPLETED · STAGE GATE BLOCKED</small><h3>调研评估已完成</h3><p>识别 {risks.length} 项风险，评估报告已生成。</p>{highRiskOpen.length > 0 && <div className="assessment-gate-warning"><b>{highRiskOpen.length}</b><span><strong>项高风险待闭环</strong><em>高风险全部闭环后才能进入规划设计阶段，请点击查看风险完成处理。</em></span></div>}</div>
                <button className="risk-gate-button" onClick={() => setPanel('risk')}>查看并闭环风险 →</button><a href={reportHref} download={`${projectName}-迁移调研评估报告.txt`}>下载报告 ↓</a>
              </div>
            )}

            {project && activeStage === 'planning' && planningStatus !== 'locked' && (
              <div className="planning-workflow">
                <div className="planning-steps">
                  <span className={planningStatus !== 'scope-review' ? 'done' : 'active'}><i>{planningStatus !== 'scope-review' ? '✓' : '1'}</i>确认迁移范围</span><b />
                  <span className={planningStatus === 'details-pending' || planningStatus === 'generating' ? 'active' : planningStatus === 'completed' ? 'done' : ''}><i>{planningStatus === 'completed' ? '✓' : '2'}</i>补充规划信息</span><b />
                  <span className={planningStatus === 'completed' ? 'done' : planningStatus === 'generating' ? 'active' : ''}><i>{planningStatus === 'completed' ? '✓' : '3'}</i>生成规划批次</span>
                </div>

                {planningStatus === 'scope-review' && <div className="planning-card scope-card"><div className="planning-card-copy"><small>STEP 1 · MIGRATION SCOPE</small><h3><Icon name="tasks" size={16} />确认虚拟机总数与迁移范围</h3><p>下载资产列表核对范围；如需调整，修改后重新上传。</p></div><div className="scope-stat"><strong>{vmCount}</strong><span>台虚拟机</span><small>初始迁移范围</small></div><div className="planning-card-actions"><a href={vmScopeHref} download={`${projectName}-虚拟机范围列表.xls`}>↓ 下载并查看范围列表</a><label className={scopeRevisionFile ? 'uploaded' : ''}><input type="file" accept=".xlsx,.xls,.csv" onChange={uploadVmScope} />{scopeRevisionFile ? `已刷新：${scopeRevisionFile}` : '↑ 上传调整后的范围'}</label><button onClick={confirmVmScope}>范围无误，确认 {vmCount} 台 →</button></div></div>}

                {(planningStatus === 'details-pending' || planningStatus === 'generating') && <div className="planning-card details-card"><div className="planning-card-copy"><small>STEP 2 · PLANNING WORKBOOK</small><h3><Icon name="file" size={16} />补充虚拟机业务信息与迁移约束</h3><p>填写模板中的业务信息、依赖关系和迁移约束，上传后生成批次计划。</p></div><div className="sheet-requirements"><div><span>01</span><p><strong>虚拟机清单</strong><small>业务系统名称、业务等级、集群类型、集群角色</small></p></div><div><span>02</span><p><strong>业务依赖关系</strong><small>上下游系统、依赖类型、端口及说明</small></p></div><div><span>03</span><p><strong>迁移约束条件</strong><small>迁移窗口、约束说明和回退要求</small></p></div></div><div className="planning-card-actions"><a href={planningTemplateHref} download={`${projectName}-迁移规划信息模板.xls`}>↓ 下载三 Sheet 规划模板</a><label className={planningWorkbook ? 'uploaded' : ''}><input type="file" accept=".xlsx,.xls" disabled={planningStatus === 'generating'} onChange={uploadPlanningWorkbook} />{planningStatus === 'generating' ? '正在校验并生成计划…' : planningWorkbook ? `已上传：${planningWorkbook}` : '选择已填写的规划模板'}</label><button onClick={useDemoPlanning} disabled={planningStatus === 'generating'}>使用示例规划信息</button></div></div>}

                {planningStatus === 'completed' && <div className="planning-result"><span>✓</span><div><small>PLANNING COMPLETED</small><h3>迁移批次与实施计划已生成</h3><p>共生成 {batchTasks.length} 项批次任务和 4 项规划风险；规划高风险闭环后可确认批次。</p></div><div className="planning-downloads"><a href={batchPlanHref} download={`${projectName}-迁移批次与实施计划.xls`}><small>实施批次计划</small><strong>下载</strong><span>↓</span></a><a href={runBookHref} download={`${projectName}-RunBook.md`}><small>RunBook</small><strong>下载</strong><span>↓</span></a></div><div className="planning-result-actions"><button onClick={() => setPanel('tasks')}>查看批次任务</button></div></div>}
                {planningStatus === 'completed' && batchConfirmation !== 'confirmed' && <div className={`batch-confirm-card ${batchConfirmation}`}><span className="batch-confirm-icon">?</span><div><small>STAGE GATE · BATCH CONFIRMATION</small><h3>请确认迁移任务批次是否需要调整</h3><p>可在对话中调整批次、范围或排期，确认后进入实施。</p></div><div className="batch-confirm-actions"><button onClick={requestBatchAdjustment}>需要调整，与 Agent 交互</button><button className="primary" onClick={confirmBatchesAndPrepareMigration}>审核交接，进入迁移实施 →</button></div></div>}
              </div>
            )}
            {project && activeStage === 'migration' && batchConfirmation === 'confirmed' && mdStatus !== 'ready' && <div className="md-onboarding-card">
              <div className="md-onboarding-head"><span>MD</span><div><small>MIGRATIONDIRECTOR CONNECTION</small><h3><Icon name="agent" size={16} />配置近端 MigrationDirector</h3><p>在近端 MD 填写以下连接信息，然后检查配置。</p></div><em className={`md-state state-${mdStatus}`}>{mdStatusText[mdStatus]}</em></div>
              <div className="md-connection-info"><div><small>服务端 IP</small><strong>23.45.2.2</strong></div><div><small>端口号</small><strong>7839</strong></div><div><small>项目 ID</small><strong>x3ddrnb</strong></div></div>
              <div className="md-check-list">
                <div className={mdStatus !== 'unconfigured' ? 'done' : ''}><i>{mdStatus !== 'unconfigured' ? '✓' : '1'}</i><span><strong>近端 MD 连接</strong><small>验证服务端地址、端口与项目 ID</small></span></div>
                <div className={mdStatus === 'checking-config' ? 'done' : mdStatus === 'connected' ? 'active' : ''}><i>2</i><span><strong>源端 VMware 发现配置</strong><small>检查保护源与资源发现状态</small></span></div>
                <div className={mdStatus === 'checking-config' ? 'done' : ''}><i>3</i><span><strong>目标端 FusionCompute 发现配置</strong><small>检查目标资源池与保护配置</small></span></div>
                <div className={mdStatus === 'checking-config' ? 'done' : ''}><i>4</i><span><strong>端口组映射</strong><small>校验源端与目标端网络映射</small></span></div>
              </div>
              <div className="md-onboarding-actions"><span>检查连接、资源发现和网络映射。</span><button onClick={startMdCheck} disabled={mdStatus !== 'unconfigured'}>{mdStatus === 'checking-connection' ? '正在检查连接…' : mdStatus === 'checking-config' ? '正在检查配置…' : '检查连接与配置 →'}</button></div>
            </div>}
            {project && activeStage === 'migration' && mdStatus === 'ready' && <>
              <details className="md-history-card"><summary><span><Icon name="check" size={15} />MD 配置检查通过</span><span>查看检查记录 <Icon name="chevron" size={13} /></span></summary><div className="md-history-list">{mdHistory.map((item) => <div key={item.id}><time>{item.time}</time><i>✓</i><p><strong>{item.title}</strong><small>{item.detail}</small></p></div>)}</div></details>
              {!allExecutionApproved && <div className="execution-approval-card"><div className="approval-card-head"><span>?</span><div><small>AGENT EXECUTION APPROVAL</small><h3>三类任务可分别查看、独立确认</h3><p>任意一类任务确认后立即启动，无需等待另外两类任务确认。</p></div></div><div className="execution-approval-list">{([{ kind: 'creation', label: '待新建任务', total: executionMetrics.creation.total }, { kind: 'cutover', label: '待割接任务', total: executionMetrics.cutover.total }, { kind: 'sync', label: '待增量同步任务', total: executionMetrics.sync.total }] as const).map((item, index) => <div className={executionApprovals[item.kind] ? 'confirmed' : 'current'} key={item.kind}><span>{executionApprovals[item.kind] ? '✓' : index + 1}</span><p><strong>{item.label}</strong><small>共 {item.total} 个任务</small></p><div className="approval-actions"><button className="view" onClick={() => openExecutionTaskPanel(item.kind)}>查看任务</button><button disabled={executionApprovals[item.kind] || executionMetrics[item.kind].completed === item.total} onClick={() => confirmExecutionType(item.kind)}>{executionMetrics[item.kind].completed === item.total ? '已完成' : executionApprovals[item.kind] ? '正在执行' : '确认并立即执行'}</button></div></div>)}</div></div>}
              {allExecutionApproved && <div className="execution-summary"><Icon name="check" /><div><strong>三类实施任务已确认</strong><p>执行进度会持续更新在右侧。你可以继续查看任务明细。</p></div><button onClick={() => setPanel('tasks')}>查看任务</button></div>}

            </>}
            {project && activeStage === 'validation' && validationTasks.length > 0 && <div className="validation-dashboard">
              <div className="validation-dashboard-icon">✓</div><div><small>RESULT VALIDATION · TODAY</small><h3>割接已完成，验证结果列表已生成</h3><p>验证子智能体已对 {validationTasks.length} 台虚拟机完成源端与目标端配置对比。请查看今日验证列表，确认无问题后逐台“人工确认 OK”；整批全部确认后批次自动更新为迁移完成。</p></div><div className="validation-progress"><span><i style={{ width: `${Math.round((confirmedValidationCount / validationTasks.length) * 100)}%` }} /></span><strong>{Math.round((confirmedValidationCount / validationTasks.length) * 100)}%</strong><button onClick={() => setPanel('validation')}>查看今日验证列表 →</button></div>
            </div>}

              </div> : !visibleMessages.length ? <section className="stage-chat-intro"><Icon name="chat" size={22} /><h2>在{active.title}中开启讨论</h2><p>已关联「{projectName}」的阶段资料与任务。可以直接提问，或从输入框上方选择操作；执行结果会同步到整个项目。</p></section> : null}
            </div>}
            {agentTyping && !isManagement && <div className="thinking-status" role="status"><span className="thinking-dot" />正在整理信息…</div>}
            {!agentTyping && !panel && project && !temporaryChat && (currentStageChat.kind === 'main' || visibleMessages.length > 0) && <div className="follow-up-prompts"><button onClick={() => sendPrompt('告诉我下一步该做什么')}>下一步该做什么？<Icon name="right" size={14} /></button><button onClick={() => sendPrompt('总结当前项目进度')}>总结当前进度<Icon name="right" size={14} /></button></div>}
          </div>
        </div>
        {!isManagement && (project || temporaryChat) && <footer className="composer-area">{project && !temporaryChat && <div className="composer-shortcuts"><ShortcutMenu groups={quickGroups[activeStage]} /></div>}<form className="chat-composer" onSubmit={submitQuestion}><textarea ref={composer} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (question.trim()) sendPrompt(question); } }} rows={2} placeholder={temporaryChat ? '发送消息，开始讨论…' : `与${active.agent}一起推进，或选择上方快捷对话…`} aria-label="向迁移智能体提问" /><div className="composer-bottom"><button type="button" className="icon-button" disabled={Boolean(temporaryChat)} aria-label="查看当前阶段资料" onClick={() => { showStageWork(); setToast('可在对话中的资料区域选择文件'); inlineWork.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><Icon name="plus" size={21} /></button><span><Icon name="agent" size={14} />{temporaryChat ? '对话' : active.title}</span><button className="send-button" type="submit" disabled={!question.trim() || agentTyping} aria-label="发送消息"><Icon name="arrow" size={18} /></button></div></form><p className="composer-note">Enter 发送 · Shift + Enter 换行</p></footer>}
      </section>
      {showInspector && <AgentPanel running={runningStages[activeStage]} status={currentStatus} steps={currentSteps} stats={stageStats} artifacts={artifacts} events={visibleMessages.filter((m) => m.operation).map((m) => ({ text: m.text, time: m.time }))} onClose={() => { setInspectorOpen(false); setCompactInspectorOpen(false); }} />}
      {toast && <div className="toast" role="status"><Icon name="info" size={17} />{toast}<button aria-label="关闭提示" onClick={() => setToast('')}><Icon name="close" size={14} /></button></div>}
    </main>
  );
}

function ValidationPanel({ tasks, completedBatchIds, onConfirm, onConfirmBatch, onClose }: { tasks: ValidationVm[]; completedBatchIds: string[]; onConfirm: (id: string) => void; onConfirmBatch: (ids: string[]) => void; onClose: () => void }) {
  const [selectedTask, setSelectedTask] = useState<ValidationVm | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | '待确认' | '迁移完成'>('全部');
  const visibleTasks = tasks.filter((task) => (statusFilter === '全部' || (statusFilter === '迁移完成' ? task.confirmed : !task.confirmed)) && `${task.batchId}${task.batchPhase}${task.vmName}`.toLowerCase().includes(query.toLowerCase()));
  const confirmedCount = tasks.filter((task) => task.confirmed).length;
  const selectableVisibleIds = visibleTasks.filter((task) => !task.confirmed && task.comparison === '一致').map((task) => task.id);
  const selectedConfirmableIds = selectedIds.filter((id) => tasks.some((task) => task.id === id && !task.confirmed && task.comparison === '一致'));
  function confirmSelected() {
    onConfirmBatch(selectedConfirmableIds);
    setSelectedIds([]);
  }
  const comparisonGroups = selectedTask ? [
    { title: 'CPU', icon: 'CPU', rows: [['虚拟机总核数', selectedTask.source.cpu.totalCores, selectedTask.target.cpu.totalCores], ['CPU 预留值', selectedTask.source.cpu.reservation, selectedTask.target.cpu.reservation], ['CPU 资源份额', selectedTask.source.cpu.shares, selectedTask.target.cpu.shares], ['CPU 上限', selectedTask.source.cpu.limit, selectedTask.target.cpu.limit], ['CPU 热插拔', selectedTask.source.cpu.hotPlug, selectedTask.target.cpu.hotPlug]] },
    { title: '内存', icon: 'MEM', rows: [['内存总大小', selectedTask.source.memory.totalSize, selectedTask.target.memory.totalSize], ['内存预留值', selectedTask.source.memory.reservation, selectedTask.target.memory.reservation], ['内存资源份额', selectedTask.source.memory.shares, selectedTask.target.memory.shares], ['内存热插拔', selectedTask.source.memory.hotPlug, selectedTask.target.memory.hotPlug]] },
    { title: '磁盘', icon: 'DSK', rows: [['磁盘总线类型', selectedTask.source.disk.busType, selectedTask.target.disk.busType], ['槽位编号', selectedTask.source.disk.slot, selectedTask.target.disk.slot], ['磁盘大小', selectedTask.source.disk.size, selectedTask.target.disk.size], ['磁盘类型', selectedTask.source.disk.type, selectedTask.target.disk.type]] },
    { title: '网络', icon: 'NET', rows: [['IP', selectedTask.source.network.ip, selectedTask.target.network.ip], ['MAC', selectedTask.source.network.mac, selectedTask.target.network.mac], ['网卡总线编号', selectedTask.source.network.busNumber, selectedTask.target.network.busNumber], ['路由', selectedTask.source.network.route, selectedTask.target.network.route], ['网卡 IO 环大小', selectedTask.source.network.ioRing, selectedTask.target.network.ioRing], ['网卡队列数', selectedTask.source.network.queues, selectedTask.target.network.queues], ['网卡 Poll 加速值', selectedTask.source.network.pollAcceleration, selectedTask.target.network.pollAcceleration], ['DNS', selectedTask.source.network.dns, selectedTask.target.network.dns], ['网关', selectedTask.source.network.gateway, selectedTask.target.network.gateway], ['TCP/IP 协议栈配置', selectedTask.source.network.tcpIpStack, selectedTask.target.network.tcpIpStack]] },
    { title: '显卡', icon: 'GPU', rows: [['类型', selectedTask.source.display.type, selectedTask.target.display.type], ['显存大小', selectedTask.source.display.memory, selectedTask.target.display.memory]] },
  ] : [];

  if (selectedTask) return <div className="panel-backdrop">
    <aside className="archive-panel validation-panel validation-detail" role="region" aria-label={`${selectedTask.vmName} 验证结果详情`}>
      <header><div><p>VM VALIDATION RESULT</p><h2>虚拟机配置对比结果</h2><span>{selectedTask.batchId} · {selectedTask.vmName}</span></div><div className="validation-head-actions"><button onClick={() => setSelectedTask(null)}>← 返回列表</button><button onClick={onClose} aria-label="关闭">×</button></div></header>
      <div className="validation-identity"><div><small>虚拟机名称</small><strong>{selectedTask.vmName}</strong></div><div><small>虚拟机 UUID</small><strong>{selectedTask.uuid}</strong></div><div><small>操作系统类型</small><strong>{selectedTask.osType}</strong></div><div><small>总体对比结果</small><strong className="validation-match">✓ {selectedTask.comparison}</strong></div></div>
      <div className="comparison-column-head"><span>配置项</span><b>源端配置</b><b>目标端配置</b><em>结果</em></div>
      <div className="comparison-groups">{comparisonGroups.map((group) => <section key={group.title} className="comparison-group"><header><span>{group.icon}</span><h3>{group.title}</h3><em>{group.rows.length} 项一致</em></header><div>{group.rows.map(([label, source, target]) => <div className="comparison-row" key={label}><span>{label}</span><b>{source}</b><b>{target}</b><em>✓ 一致</em></div>)}</div></section>)}</div>
      <div className="validation-approval"><span className={selectedTask.confirmed ? 'approved' : ''}>{selectedTask.confirmed ? '✓' : '!'}</span><div><strong>{selectedTask.confirmed ? '该虚拟机已人工确认迁移完成' : '请完成最终人工验收'}</strong><p>{selectedTask.confirmed ? '确认记录已写入验证时间线，并同步更新批次状态。' : '确认源端与目标端配置对比无问题后，点击“人工确认 OK”。'}</p></div><button disabled={selectedTask.confirmed || selectedTask.comparison !== '一致'} onClick={() => { onConfirm(selectedTask.id); setSelectedTask({ ...selectedTask, confirmed: true }); }}>{selectedTask.confirmed ? '已确认 OK' : '人工确认 OK'}</button></div>
    </aside>
  </div>;

  return <div className="panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="archive-panel validation-panel" role="region" aria-label="今日虚拟机验证列表">
      <header><div><p>RESULT VALIDATION WORKSPACE</p><h2>今日虚拟机验证列表</h2><span>源端与目标端配置自动对比，人工确认后完成迁移</span></div><button onClick={onClose} aria-label="关闭">×</button></header>
      <div className="validation-kpis"><div data-tone="info"><small>今日进入验证</small><strong>{tasks.length}</strong><em>已完成割接的虚拟机</em></div><div data-tone="success"><small>Agent 对比一致</small><strong>{tasks.filter((task) => task.comparison === '一致').length}</strong><em>配置自动验证通过</em></div><div data-tone="success"><small>人工已确认</small><strong>{confirmedCount}</strong><em>{tasks.length - confirmedCount} 台待确认</em></div><div data-tone="success"><small>迁移完成批次</small><strong>{completedBatchIds.length}</strong><em>全批次验证完成</em></div></div>
      <div className="validation-toolbar"><div>{(['全部', '待确认', '迁移完成'] as const).map((status) => <button key={status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>{status} <b>{status === '全部' ? tasks.length : status === '迁移完成' ? confirmedCount : tasks.length - confirmedCount}</b></button>)}<button className="validation-bulk-confirm" disabled={!selectedConfirmableIds.length} onClick={confirmSelected}>✓ 批量确认 OK {selectedConfirmableIds.length ? `(${selectedConfirmableIds.length})` : ''}</button></div><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="查询批次编号、阶段或虚拟机名称" /></label></div>
      <div className="validation-table-wrap"><table className="validation-table"><thead><tr><th><input type="checkbox" aria-label="选择全部待确认虚拟机" checked={selectableVisibleIds.length > 0 && selectableVisibleIds.every((id) => selectedIds.includes(id))} onChange={(event) => setSelectedIds(event.target.checked ? Array.from(new Set([...selectedIds, ...selectableVisibleIds])) : selectedIds.filter((id) => !selectableVisibleIds.includes(id)))} /></th><th>批次编号</th><th>批次阶段</th><th>虚拟机名称</th><th>源端配置</th><th>目标端配置</th><th>验证结果对比</th><th>验收状态</th><th>操作</th></tr></thead><tbody>{visibleTasks.length ? visibleTasks.map((task) => <tr key={task.id}><td><input type="checkbox" aria-label={`选择 ${task.vmName}`} disabled={task.confirmed || task.comparison !== '一致'} checked={selectedIds.includes(task.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, task.id] : ids.filter((id) => id !== task.id))} /></td><td><strong>{task.batchId}</strong></td><td><span className={`batch-phase phase-${task.batchPhase}`}>{task.batchPhase}</span></td><td><strong>{task.vmName}</strong><small>{task.osType}</small></td><td><span className="config-summary">{task.source.cpu.totalCores} · {task.source.memory.totalSize}<small>{task.source.disk.size} · {task.source.network.ip}</small></span></td><td><span className="config-summary">{task.target.cpu.totalCores} · {task.target.memory.totalSize}<small>{task.target.disk.size} · {task.target.network.ip}</small></span></td><td><button className="comparison-link" onClick={() => setSelectedTask(task)}><span>✓ {task.comparison}</span><small>查看结果信息 →</small></button></td><td><span className={task.confirmed ? 'validation-status confirmed' : 'validation-status'}>{task.confirmed ? '迁移完成' : '待人工确认'}</span></td><td><button className="validation-single-confirm" disabled={task.confirmed || task.comparison !== '一致'} onClick={() => { onConfirm(task.id); setSelectedIds((ids) => ids.filter((id) => id !== task.id)); }}>{task.confirmed ? '已确认' : '确认 OK'}</button></td></tr>) : <tr><td colSpan={9} className="empty-row">暂无符合条件的验证任务</td></tr>}</tbody></table></div>
      <div className="validation-foot"><span>共 {visibleTasks.length} 条 · 示例配置对比完成</span><p>批次内全部虚拟机人工确认后，批次自动更新为“迁移完成”</p></div>
    </aside>
  </div>;
}

function CutoverTaskPanel({ tasks, completedIds, running, onComplete, onClose, onNotify }: { tasks: VmTask[]; completedIds: string[]; running: boolean; onComplete: (taskIds: string[]) => void; onClose: () => void; onNotify: (message: string) => void }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visibleTasks = tasks.filter((task) => (statusFilter === '全部' || task.status === statusFilter) && `${task.name}${task.targetIp}${task.id}`.toLowerCase().includes(query.toLowerCase()));
  const selectableIds = tasks.filter((task) => !completedIds.includes(task.id)).map((task) => task.id);
  const actionableIds = selectedIds.filter((id) => selectableIds.includes(id));
  const statusCount = (status: string) => status === '全部' ? tasks.length : tasks.filter((task) => task.status === status).length;

  return <div className="panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="archive-panel task-panel cutover-panel" role="region" aria-label="今日待割接任务">
      <header><div><p>TODAY&apos;S CUTOVER QUEUE</p><h2>今日待割接任务</h2><span>任务详情与任务管理中的单虚拟机执行记录保持一致</span></div><button onClick={onClose} aria-label="关闭">×</button></header>
      <div className="cutover-kpis"><div data-tone="info"><small>待割接任务</small><strong>{tasks.length}</strong><em>来自今日割接验证批次</em></div><div data-tone="success"><small>同步已完成</small><strong>{tasks.filter((task) => task.status === '成功').length}</strong><em>可进入割接前检查</em></div><div data-tone="brand"><small>同步处理中</small><strong>{tasks.filter((task) => task.status === '同步中').length}</strong><em>持续监控数据状态</em></div><div data-tone="brand"><small>已选择</small><strong>{selectedIds.length}</strong><em>支持批量发起割接</em></div></div>
      <div className="vm-task-tabs">{['全部', '成功', '待同步', '同步中', '暂停'].map((status) => <button key={status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>{status} <b>{statusCount(status)}</b></button>)}</div>
      <p className="shared-task-note" role="status">{running ? "割接队列正在执行，所有会话共享此状态。" : `已完成 ${completedIds.length} / ${tasks.length} 个割接任务。`}</p><div className="vm-task-toolbar"><div><button disabled={running || !actionableIds.length} onClick={() => onNotify(`已对 ${selectedIds.length} 个任务发起割接前检查`)}>✓ 割接前检查</button><button className="complete-cutover" disabled={running || !actionableIds.length} onClick={() => { onComplete(actionableIds); setSelectedIds([]); }}>✓ 确认割接完成</button><button onClick={() => onNotify('待割接任务报告已导出（演示）')}>⇩ 导出报告</button></div><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入任务名称、目标 IP 或任务编号" /></label><button onClick={() => { setQuery(''); setStatusFilter('全部'); }}>↻</button></div>
      <div className="vm-table-wrap"><table className="vm-task-table"><thead><tr><th><input type="checkbox" disabled={running || !selectableIds.length} checked={selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))} onChange={(event) => setSelectedIds(event.target.checked ? selectableIds : [])} aria-label="选择全部待割接任务" /></th><th>任务名称</th><th>迁移目标 IP</th><th>任务状态</th><th>校验状态</th><th>任务进度</th><th>当前已迁移/总量</th><th>迁移速率</th><th>开始时间</th><th>结束时间</th><th>耗时</th><th>剩余迁移时间</th><th>操作</th></tr></thead><tbody>{visibleTasks.length ? visibleTasks.map((task) => <tr key={task.id}><td><input type="checkbox" disabled={running || completedIds.includes(task.id)} checked={selectedIds.includes(task.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, task.id] : ids.filter((id) => id !== task.id))} aria-label={`选择 ${task.name}`} /></td><td><strong>{task.name}</strong><small>{task.id}</small></td><td>{task.targetIp}</td><td><span className={`vm-status status-${task.status}`}>{completedIds.includes(task.id) ? '割接完成' : running ? '割接执行中' : task.status}</span></td><td>{task.checkStatus}</td><td><div className="vm-progress"><span><i style={{ width: `${task.progress}%` }} /></span><b>{task.progress}%</b></div></td><td>{task.migrated}</td><td>{task.speed}</td><td>{task.startTime}</td><td>{task.endTime}</td><td>{task.duration}</td><td>{task.remaining}</td><td><button className="vm-more" onClick={() => onNotify(`${task.name} 割接任务详情已打开`)}>详情 ···</button></td></tr>) : <tr><td className="empty-row" colSpan={13}>暂无符合条件的待割接任务</td></tr>}</tbody></table></div>
      <div className="vm-table-foot"><span>总条数：{visibleTasks.length} · 今日割接窗口 22:00–次日 02:00</span><div><button>10 / 页⌄</button><button>‹</button><b>1</b><button>›</button></div></div>
    </aside>
  </div>;
}

function SyncTaskPanel({ batches, total, completed, onClose }: { batches: BatchTask[]; total: number; completed: number; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const rows = batches.flatMap((batch) => batch.vmNames.map((vmName, index) => ({ id: `${batch.id}-SYNC-${String(index + 1).padStart(2, '0')}`, batchId: batch.id, batchPhase: batch.batchPhase, vmName, source: `快照 S-${batch.id.slice(2)}-${String(index + 1).padStart(2, '0')}`, target: `10.88.${Number(batch.id.slice(2))}.${30 + index}`, window: `${batch.startDate} 20:00`, size: `${42 + index * 3} GB` }))).slice(0, total || 8);
  const visible = rows.filter((row) => `${row.id}${row.batchId}${row.vmName}${row.target}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="archive-panel task-panel sync-panel" role="region" aria-label="今日待增量同步任务">
      <header><div><p>TODAY&apos;S INCREMENTAL SYNC</p><h2>今日待增量同步任务</h2><span>查看每台虚拟机的同步窗口、源端快照与目标端信息</span></div><button onClick={onClose} aria-label="关闭">×</button></header>
      <div className="cutover-kpis"><div data-tone="info"><small>同步任务</small><strong>{rows.length}</strong><em>来自迁移批次计划</em></div><div data-tone="success"><small>已完成</small><strong>{Math.min(completed, rows.length)}</strong><em>数据校验通过</em></div><div data-tone="brand"><small>运行中</small><strong>{completed < rows.length && completed > 0 ? 1 : 0}</strong><em>持续同步变化块</em></div><div data-tone="info"><small>待执行</small><strong>{Math.max(0, rows.length - completed)}</strong><em>等待同步窗口</em></div></div>
      <div className="sync-toolbar"><p>增量同步任务完成后，任务状态仍可在此查看。</p><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="查询任务编号、批次或虚拟机" /></label></div>
      <div className="sync-table-wrap"><table className="sync-table"><thead><tr><th>任务编号</th><th>批次编号</th><th>批次阶段</th><th>虚拟机名称</th><th>源端快照</th><th>目标端 IP</th><th>同步数据量</th><th>计划窗口</th><th>任务状态</th></tr></thead><tbody>{visible.length ? visible.map((row, index) => { const done = index < completed; const running = !done && index === completed && completed > 0; return <tr key={row.id}><td><strong>{row.id}</strong></td><td>{row.batchId}</td><td><span className={`batch-phase phase-${row.batchPhase}`}>{row.batchPhase}</span></td><td>{row.vmName}</td><td>{row.source}</td><td>{row.target}</td><td>{row.size}</td><td>{row.window}</td><td><span className={`sync-status ${done ? 'done' : running ? 'running' : ''}`}>{done ? '已完成' : running ? '运行中' : '待执行'}</span></td></tr>; }) : <tr><td colSpan={9} className="empty-row">暂无符合条件的增量同步任务</td></tr>}</tbody></table></div>
    </aside>
  </div>;
}

function CreationTaskPanel({ tasks, locked, onChange, onClose, onNotify }: { tasks: CreationTask[]; locked: boolean; onChange: (tasks: CreationTask[]) => void; onClose: () => void; onNotify: (message: string) => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(tasks.map((task) => task.id));
  const [editingTask, setEditingTask] = useState<CreationTask | null>(null);
  const [draftTask, setDraftTask] = useState<CreationTask | null>(null);
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [computeResource, setComputeResource] = useState('FusionCompute-生产集群-A');
  const [portGroup, setPortGroup] = useState('managePortgroup');
  const [delayAllocation, setDelayAllocation] = useState(false);
  const [keepUuid, setKeepUuid] = useState(false);
  const visibleTasks = tasks.filter((task) => `${task.hostName}${task.vmName}${task.taskName}`.toLowerCase().includes(query.toLowerCase()));
  const confirmedCount = tasks.filter((task) => task.status === '已确认' || task.status === '已创建').length;
  const allConfirmed = tasks.length > 0 && tasks.every((task) => task.status === '已确认' || task.status === '已创建');

  function openWizard(task: CreationTask) {
    if (locked || task.status === '已创建') { onNotify('任务正在执行或已创建，配置已锁定'); return; }
    setEditingTask(task);
    setDraftTask({ ...task });
    setStep(1);
  }

  function confirmTask() {
    if (locked || !editingTask || !draftTask || tasks.find((task) => task.id === editingTask.id)?.status === '已创建') return;
    onChange(tasks.map((task) => task.id === editingTask.id ? { ...draftTask, status: '已确认' } : task));
    setEditingTask(null);
    setDraftTask(null);
    setStep(1);
    onNotify(`${draftTask.vmName} 任务信息已确认`);
  }

  function confirmSelectedTasks() {
    if (locked) return;
    const confirmable = tasks.filter((task) => selectedIds.includes(task.id) && task.status === '待配置');
    if (!confirmable.length) {
      onNotify('所选任务已确认或已创建');
      return;
    }
    onChange(tasks.map((task) => selectedIds.includes(task.id) && task.status === '待配置' ? { ...task, status: '已确认' } : task));
    onNotify(`已批量确认 ${confirmable.length} 个待新建任务`);
  }

  function createAllTasks() {
    if (locked || tasks.every((task) => task.status === '已创建')) return;
    if (!allConfirmed) {
      onNotify(`仍有 ${tasks.length - confirmedCount} 个任务待确认`);
      return;
    }
    onChange(tasks.map((task) => ({ ...task, status: '已创建' })));
    onNotify(`已批量创建 ${tasks.length} 个迁移任务`);
  }

  if (editingTask && draftTask) return <div className="panel-backdrop">
    <aside className="archive-panel creation-panel creation-wizard" role="region" aria-label="创建迁移任务">
      <header><div><p>CREATE MIGRATION TASK</p><h2>配置迁移任务</h2><span>{editingTask.vmName} · {editingTask.id}</span></div><button onClick={() => setEditingTask(null)} aria-label="关闭配置">×</button></header>
      <div className="wizard-steps"><button className={step === 1 ? 'active' : step > 1 ? 'done' : ''} onClick={() => setStep(1)}><i>{step > 1 ? '✓' : '1'}</i><span>任务配置</span></button><b /><button className={step === 2 ? 'active' : step > 2 ? 'done' : ''} onClick={() => step > 1 && setStep(2)}><i>{step > 2 ? '✓' : '2'}</i><span>目的 VM 与网络配置</span></button><b /><button className={step === 3 ? 'active' : ''} onClick={() => step > 2 && setStep(3)}><i>3</i><span>确认信息</span></button></div>
      <div className="wizard-body">
        {step === 1 && <div className="wizard-section"><div className="wizard-section-head"><small>STEP 1</small><h3>确认源端虚拟机与任务信息</h3><p>源端检查已通过，可修改任务名称后进入目的端配置。</p></div><div className="source-summary"><div><small>源端主机</small><strong>{draftTask.hostName}</strong></div><div><small>虚拟机</small><strong>{draftTask.vmName}</strong></div><div><small>操作系统</small><strong>{draftTask.os}</strong></div><div><small>检查结果</small><strong className="check-pass">✓ 通过</strong></div></div><div className="wizard-form"><label className="wide"><span>任务名称</span><input value={draftTask.taskName} onChange={(event) => setDraftTask({ ...draftTask, taskName: event.target.value })} /></label><label><span>固件版本</span><select value={draftTask.firmware} onChange={(event) => setDraftTask({ ...draftTask, firmware: event.target.value as CreationTask['firmware'] })}><option>BIOS</option><option>UEFI</option></select></label><label><span>迁移策略</span><select defaultValue="按计划执行"><option>按计划执行</option><option>立即执行</option></select></label></div></div>}
        {step === 2 && <div className="wizard-section"><div className="wizard-section-head"><small>STEP 2</small><h3>目的 VM 与网络配置</h3><p>确认目标计算资源、规格、磁盘和端口组映射。</p></div><div className="resource-hints"><span>推荐规格</span><b>CPU：{draftTask.cpu} 核</b><b>内存：{draftTask.memory}</b></div><div className="wizard-form"><label className="wide"><span>目的虚拟机名称</span><input value={draftTask.vmName} onChange={(event) => setDraftTask({ ...draftTask, vmName: event.target.value })} /></label><label className="wide"><span>计算资源</span><select value={computeResource} onChange={(event) => setComputeResource(event.target.value)}><option>FusionCompute-生产集群-A</option><option>FusionCompute-生产集群-B</option></select></label><label className="wide"><span>操作系统版本</span><input value={draftTask.os} onChange={(event) => setDraftTask({ ...draftTask, os: event.target.value })} /></label><label><span>CPU 核数</span><input type="number" min="1" value={draftTask.cpu} onChange={(event) => setDraftTask({ ...draftTask, cpu: Number(event.target.value) })} /></label><label><span>内存大小</span><input value={draftTask.memory} onChange={(event) => setDraftTask({ ...draftTask, memory: event.target.value })} /></label><label><span>显卡</span><select defaultValue="VGA · 4MB"><option>VGA · 4MB</option><option>VGA · 8MB</option></select></label><label className="wide"><span>网卡迁移 / 端口组</span><select value={portGroup} onChange={(event) => setPortGroup(event.target.value)}><option>managePortgroup</option><option>business-prod-vlan</option><option>database-backend-vlan</option></select></label><label className="wide"><span>磁盘配置</span><input value={draftTask.disk} onChange={(event) => setDraftTask({ ...draftTask, disk: event.target.value })} /></label></div><div className="advanced-options"><label><button type="button" className={delayAllocation ? 'on' : ''} onClick={() => setDelayAllocation((value) => !value)}><i /></button><span><strong>延迟分配</strong><small>按需分配目标存储空间</small></span></label><label><button type="button" className={keepUuid ? 'on' : ''} onClick={() => setKeepUuid((value) => !value)}><i /></button><span><strong>UUID 与源端保持一致</strong><small>保留源端虚拟机唯一标识</small></span></label></div></div>}
        {step === 3 && <div className="wizard-section confirm-section"><div className="wizard-section-head"><small>STEP 3</small><h3>确认迁移任务信息</h3><p>确认无误后，该任务将进入批量任务创建队列。</p></div><div className="confirm-grid"><div><small>任务名称</small><strong>{draftTask.taskName}</strong></div><div><small>源端虚拟机</small><strong>{editingTask.vmName}</strong></div><div><small>目的虚拟机</small><strong>{draftTask.vmName}</strong></div><div><small>计算资源</small><strong>{computeResource}</strong></div><div><small>CPU / 内存</small><strong>{draftTask.cpu} 核 / {draftTask.memory}</strong></div><div><small>磁盘</small><strong>{draftTask.disk}</strong></div><div><small>网络端口组</small><strong>{portGroup}</strong></div><div><small>高级配置</small><strong>{delayAllocation ? '延迟分配' : '预分配'} · {keepUuid ? '保留 UUID' : '新建 UUID'}</strong></div></div><div className="confirm-notice"><span>!</span><p><strong>确认后仍可在批量创建前修改</strong>所有任务均确认后，“批量创建任务”按钮才会开放。</p></div></div>}
      </div>
      <div className="wizard-foot"><button onClick={() => step === 1 ? setEditingTask(null) : setStep((value) => value - 1)}>{step === 1 ? '取消' : '上一步'}</button>{step < 3 ? <button className="primary" onClick={() => setStep((value) => value + 1)} disabled={step === 1 && !draftTask.taskName.trim()}>下一步 →</button> : <button className="primary" onClick={confirmTask}>确认任务信息</button>}</div>
    </aside>
  </div>;

  return <div className="panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="archive-panel creation-panel" role="region" aria-label="待新建迁移任务">
      <header><div><p>NEW MIGRATION TASK QUEUE</p><h2>今日待新建任务</h2><span>逐台查看并确认目的 VM 配置，全部确认后批量创建</span></div><button onClick={onClose} aria-label="关闭">×</button></header>
      <div className="creation-summary"><div data-tone="info"><small>待新建</small><strong>{tasks.filter((task) => task.status === '待配置').length}</strong></div><div data-tone="brand"><small>已确认</small><strong>{tasks.filter((task) => task.status === '已确认').length}</strong></div><div data-tone="success"><small>已创建</small><strong>{tasks.filter((task) => task.status === '已创建').length}</strong></div><span><i />源端检查通过，任务信息来自今日迁移批次</span></div>
      <p className="shared-task-note" role="status">{locked ? "任务已提交，所有会话共享执行状态，配置已锁定。" : "确认的配置会同步到当前项目的所有会话。"}</p><div className="creation-toolbar"><div><button className="bulk-confirm" disabled={locked || !selectedIds.length || !tasks.some((task) => selectedIds.includes(task.id) && task.status === '待配置')} onClick={confirmSelectedTasks}>✓ 批量确认</button><button className="primary" disabled={locked || !allConfirmed || tasks.every((task) => task.status === '已创建')} onClick={createAllTasks}>＋ 批量创建任务</button><span>已选择 {selectedIds.length}</span></div><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入虚拟机或任务名称" /></label></div>
      <div className="creation-table-wrap"><table className="creation-table"><thead><tr><th><input type="checkbox" checked={selectedIds.length === tasks.length && tasks.length > 0} onChange={(event) => setSelectedIds(event.target.checked ? tasks.map((task) => task.id) : [])} aria-label="选择全部" /></th><th>主机名称</th><th>虚拟机名称</th><th>状态</th><th>操作系统</th><th>固件版本</th><th>CPU</th><th>内存</th><th>磁盘</th><th>VMTools 状态</th><th>检查结果</th><th>任务名称</th><th>任务状态</th><th>操作</th></tr></thead><tbody>{visibleTasks.map((task) => <tr key={task.id}><td><input type="checkbox" checked={selectedIds.includes(task.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, task.id] : ids.filter((id) => id !== task.id))} aria-label={`选择 ${task.vmName}`} /></td><td>{task.hostName}</td><td><strong>{task.vmName}</strong><small>{task.id}</small></td><td>{task.powerState}</td><td>{task.os}</td><td>{task.firmware}</td><td>{task.cpu}</td><td>{task.memory}</td><td>{task.disk}</td><td>{task.vmtools}</td><td><span className="check-pass">✓ {task.check}</span></td><td>{task.taskName}</td><td><span className={`creation-status status-${task.status}`}>{task.status}</span></td><td><button className="configure-task" disabled={locked || task.status === '已创建'} onClick={() => openWizard(task)}>{task.status === '待配置' ? '配置任务' : task.status === '已确认' ? '查看 / 修改' : '已创建'}</button></td></tr>)}</tbody></table></div>
      <div className="creation-foot"><span>共 {visibleTasks.length} 条 · 已确认 {confirmedCount}/{tasks.length}</span><p>{allConfirmed ? '全部任务已确认，可以批量创建' : `还有 ${tasks.length - confirmedCount} 个任务需要确认`}</p></div>
    </aside>
  </div>;
}

function TaskPanel({ projectId, batches, creationTasks, risks, completedBatchIds, projectExists, onClose, onNotify }: { projectId: string; batches: BatchTask[]; creationTasks: CreationTask[]; risks: RiskItem[]; completedBatchIds: string[]; projectExists: boolean; onClose: () => void; onNotify: (message: string) => void }) {
  const [activeTab, setActiveTab] = useState<'batches' | 'tasks'>('batches');
  const [selectedBatch, setSelectedBatch] = useState<BatchTask | null>(null);
  const [selectedVm, setSelectedVm] = useState<VmTask | null>(null);
  const [selectedVmIds, setSelectedVmIds] = useState<string[]>([]);
  const [batchPhaseFilter, setBatchPhaseFilter] = useState<'全部' | BatchTask['batchPhase']>('全部');
  const [showGantt, setShowGantt] = useState(false);
  const [selectedGanttBatchId, setSelectedGanttBatchId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | '已创建' | '未创建'>('全部');
  const totalVms = new Set(batches.flatMap((batch) => batch.vmNames)).size;
  const visibleBatches = batchPhaseFilter === '全部' ? batches : batches.filter((batch) => batch.batchPhase === batchPhaseFilter);
  const ganttDays = Array.from({ length: 17 }, (_, index) => 7 + index);
  const activeBatch = selectedBatch ?? batches[0] ?? null;
  const vmTasks = activeBatch ? buildVmTasks(activeBatch) : [];
  const creationByVm = new Map(creationTasks.map((task) => [task.vmName, task]));
  const isCreated = (vmName: string) => creationByVm.get(vmName)?.status === '已创建';
  const visibleVmTasks = vmTasks.filter((task) => (statusFilter === '全部' || (statusFilter === '已创建' ? isCreated(task.name) : !isCreated(task.name))) && `${task.name}${task.id}${task.targetIp}`.toLowerCase().includes(query.toLowerCase()));
  const createdCount = vmTasks.filter((task) => isCreated(task.name)).length;
  const selectedCreation = selectedVm ? creationByVm.get(selectedVm.name) : undefined;
  const vmSequence = selectedVm ? Math.max(0, vmTasks.findIndex((task) => task.id === selectedVm.id)) : 0;
  const selectedVmRisks = selectedVm ? risks.filter((risk) => !risk.closed && (risk.stage === 'research' || risk.stage === 'planning')).slice(vmSequence % 2, vmSequence % 2 + 2) : [];
  const selectedVmOs = selectedCreation?.os ?? (vmSequence % 3 === 0 ? 'Debian GNU/Linux 11' : vmSequence % 3 === 1 ? 'CentOS 7 (64 位)' : 'Windows Server 2019');
  const migrationTaskRows = selectedVm ? [
    [`${selectedVm.id}-FULL`, '全量同步', selectedVm.progress ? '已完成' : '待执行', selectedVm.progress ? '100%' : '0%', selectedVm.startTime, selectedVm.progress ? selectedVm.endTime : '—'],
    [`${selectedVm.id}-INC`, '增量同步', selectedVm.status === '同步中' ? '运行中' : selectedVm.status === '成功' ? '已完成' : '排队中', selectedVm.status === '成功' ? '100%' : `${selectedVm.progress}%`, selectedVm.startTime, selectedVm.endTime],
    [`${selectedVm.id}-CUT`, '割接验证', selectedVm.status === '成功' ? '已完成' : '待执行', selectedVm.status === '成功' ? '100%' : '0%', '—', '—'],
    [`${selectedVm.id}-VAL`, '结果验证', selectedVm.checkStatus === '通过' ? '已完成' : '待执行', selectedVm.checkStatus === '通过' ? '100%' : '0%', '—', '—'],
  ] : [];

  function openTaskTab(batch?: BatchTask) {
    setSelectedBatch(batch ?? selectedBatch ?? batches[0] ?? null);
    setSelectedVm(null);
    setActiveTab('tasks');
    setQuery('');
    setStatusFilter('全部');
    setSelectedVmIds([]);
  }

  function runMigrationTaskAction(action: string, taskId?: string) {
    const count = taskId ? 1 : selectedVmIds.length;
    if (!count) return;
    onNotify(`已对 ${count} 个迁移任务执行“${action}”操作`);
    if (action === '删除') setSelectedVmIds([]);
  }

  return <div className="panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="archive-panel task-panel" role="region" aria-label="任务管理">
      <header><div><p>MIGRATION TASK MANAGEMENT</p><h2>迁移任务管理</h2><span>{activeTab === 'batches' ? '按批次管理迁移计划，并下钻查看虚拟机任务' : activeBatch ? `${activeBatch.id} · ${activeBatch.batchPhase} · ${activeBatch.stageType}` : '等待规划子智能体生成迁移批次'}</span></div><div className="task-head-actions"><button onClick={onClose} aria-label="关闭">×</button></div></header>
      <nav className="task-primary-tabs" aria-label="迁移任务管理视图"><button className={activeTab === 'batches' ? 'active' : ''} onClick={() => { setActiveTab('batches'); setSelectedVm(null); }}>迁移批次 <b>{batches.length}</b></button><button className={activeTab === 'tasks' ? 'active' : ''} onClick={() => openTaskTab()}>迁移任务 <b>{totalVms}</b></button></nav>

      {activeTab === 'batches' ? <>
        <div className="panel-kpis"><div data-tone="brand"><small>批次任务</small><strong>{batches.length}</strong><em>{projectExists ? '规划子智能体生成' : '等待规划设计'}</em></div><div data-tone="info"><small>虚拟机范围</small><strong>{totalVms}</strong><em>覆盖全部规划范围</em></div><div data-tone="info"><small>批次阶段</small><strong>{batches.length ? 3 : 0}</strong><em>试点 · 攻坚 · 扩展</em></div></div>
        <div className="batch-toolbar"><div>{(['全部', '试点', '攻坚', '扩展'] as const).map((phase) => <button key={phase} className={batchPhaseFilter === phase ? 'active' : ''} onClick={() => { setBatchPhaseFilter(phase); setSelectedGanttBatchId(null); }}>{phase === '全部' ? '全部批次' : phase} {phase === '全部' ? batches.length : batches.filter((batch) => batch.batchPhase === phase).length}</button>)}</div><button className="gantt-button" disabled={!batches.length} onClick={() => { setShowGantt((value) => !value); if (!showGantt) onNotify('迁移批次甘特图已生成'); }}>{showGantt ? '收起甘特图' : '▤ 生成甘特图'}</button><button onClick={() => onNotify('批次任务由规划子智能体自动生成')}>＋ 创建任务</button></div>
        {showGantt && <div className="gantt-card"><div className="gantt-head"><div><small>MIGRATION BATCH TIMELINE</small><h3>{batchPhaseFilter === '全部' ? '全部迁移批次甘特图' : `${batchPhaseFilter}阶段批次甘特图`}</h3></div><span>2026 年 9 月 · 共 {visibleBatches.length} 个批次</span></div><div className="gantt-scroll"><div className="gantt-calendar"><div className="gantt-date-row"><span>批次 / 阶段类型</span><div>{ganttDays.map((day) => <b key={day}>{day}日</b>)}</div></div>{visibleBatches.map((batch) => { const startDay = Number(batch.startDate.slice(-2)); const left = ((startDay - 7) / ganttDays.length) * 100; const width = (batch.durationDays / ganttDays.length) * 100; return <div className={`gantt-row ${selectedGanttBatchId === batch.id ? 'selected' : ''}`} key={batch.id}><span><strong>{batch.id}</strong><small>{batch.batchPhase} · {batch.stageType}</small></span><div className="gantt-track">{ganttDays.map((day) => <i key={day} />)}<button className={`gantt-bar phase-${batch.batchPhase} ${selectedGanttBatchId === batch.id ? 'selected' : ''}`} style={{ left: `${left}%`, width: `${width}%` }} aria-pressed={selectedGanttBatchId === batch.id} onClick={() => { setSelectedGanttBatchId(batch.id); window.setTimeout(() => document.getElementById(`batch-row-${projectId}-${batch.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0); }}><b>{batch.durationDays}天 · {batch.vmNames.length}台</b></button></div></div>; })}</div></div><div className="gantt-legend"><span><i className="pilot" />试点</span><span><i className="tackle" />攻坚</span><span><i className="expand" />扩展</span></div></div>}
        <div className="batch-table-wrap"><table className="batch-table"><thead><tr><th>批次编号</th><th>批次阶段</th><th>虚拟机数量</th><th>虚拟机列表</th><th>阶段类型</th><th>开始日期</th><th>结束日期</th><th>持续天数</th><th>状态</th></tr></thead><tbody>{visibleBatches.length ? visibleBatches.map((batch) => <tr id={`batch-row-${projectId}-${batch.id}`} className={selectedGanttBatchId === batch.id ? 'selected-batch' : ''} key={batch.id}><td><strong>{batch.id}</strong></td><td><span className={`batch-phase phase-${batch.batchPhase}`}>{batch.batchPhase}</span></td><td><strong className="vm-count">{batch.vmNames.length} 台</strong></td><td><button className="vm-list-link" onClick={() => openTaskTab(batch)}><b>清单</b><small>{batch.vmNames.slice(0, 2).join('、')}{batch.vmNames.length > 2 ? '…' : ''}</small><em>查看明细 →</em></button></td><td>{batch.stageType}</td><td>{batch.startDate}</td><td>{batch.endDate}</td><td>{batch.durationDays} 天</td><td><span className={completedBatchIds.includes(batch.id) ? 'task-ready batch-complete' : 'task-ready'}><i />{completedBatchIds.includes(batch.id) ? '迁移完成' : '已规划'}</span></td></tr>) : <tr><td className="empty-row" colSpan={9}>{batches.length ? `暂无${batchPhaseFilter}阶段的批次任务` : projectExists ? '完成规划信息上传后，批次任务将在这里自动生成' : '请先创建项目'}</td></tr>}</tbody></table></div>
      </> : selectedVm ? <div className="vm-detail-view">
        <div className="vm-detail-head"><button onClick={() => setSelectedVm(null)}>← 返回迁移任务</button><div><small>VM MIGRATION DETAIL</small><h3>{selectedVm.name}</h3><p>{selectedVm.id} · {activeBatch?.id} · {isCreated(selectedVm.name) ? '任务已创建' : '任务尚未创建'}</p></div><span className={isCreated(selectedVm.name) ? 'created' : 'not-created'}>{isCreated(selectedVm.name) ? '已创建迁移任务' : '待创建迁移任务'}</span></div>
        {isCreated(selectedVm.name) ? <><div className="vm-detail-summary"><div><small>虚拟机 ID</small><strong>{selectedVm.id}</strong></div><div><small>虚拟机名称</small><strong>{selectedVm.name}</strong></div><div><small>操作系统版本</small><strong>{selectedVmOs}</strong></div><div><small>迁移方案</small><strong>免代理</strong></div></div><div className="created-task-list"><div className="created-task-list-head"><div><small>MIGRATION TASK LIST</small><h3>对应迁移任务列表</h3></div><span>共 {migrationTaskRows.length} 项</span></div><table><thead><tr><th>任务编号</th><th>任务类型</th><th>任务状态</th><th>任务进度</th><th>开始时间</th><th>结束时间</th></tr></thead><tbody>{migrationTaskRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === 2 ? <span className={`detail-task-status ${cell === '已完成' ? 'done' : cell === '运行中' ? 'running' : ''}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div></> : <div className="uncreated-vm-detail"><div className="vm-detail-summary"><div><small>虚拟机 ID</small><strong>{selectedVm.id}</strong></div><div><small>虚拟机名称</small><strong>{selectedVm.name}</strong></div><div><small>操作系统版本</small><strong>{selectedVmOs}</strong></div><div><small>迁移方案</small><strong>免代理</strong></div></div><section><header><div><small>RISK ITEMS</small><h3>风险项</h3></div><span>{selectedVmRisks.length} 项待处理</span></header>{selectedVmRisks.length ? <div className="vm-risk-list">{selectedVmRisks.map((risk) => <div key={risk.id}><b className={`risk-level level-${risk.level}`}>{risk.level}</b><p><strong>{risk.description}</strong><small>R-{String(risk.id).padStart(3, '0')} · {stageName[risk.stage]} · {risk.closed ? '已闭环' : '待闭环'}</small></p></div>)}</div> : <div className="vm-no-risk"><span>✓</span><p><strong>当前虚拟机未关联未闭环风险</strong><small>任务创建前仍将执行兼容性与资源检查。</small></p></div>}</section></div>}
      </div> : <>
        <div className="migration-task-context"><div><small>当前批次</small><select value={activeBatch?.id ?? ''} onChange={(event) => { setSelectedBatch(batches.find((batch) => batch.id === event.target.value) ?? null); setQuery(''); setStatusFilter('全部'); setSelectedVmIds([]); }} disabled={!batches.length}>{batches.length ? batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.id} · {batch.batchPhase} · {batch.stageType}</option>) : <option>暂无迁移批次</option>}</select></div><p><span><i className="created" />已创建 {createdCount}</span><span><i />未创建 {Math.max(0, vmTasks.length - createdCount)}</span></p></div>
        <div className="vm-task-tabs">{(['全部', '已创建', '未创建'] as const).map((status) => { const count = status === '全部' ? vmTasks.length : status === '已创建' ? createdCount : vmTasks.length - createdCount; return <button key={status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>{status} <b>{count}</b></button>; })}</div>
        <div className="vm-task-toolbar migration-task-toolbar"><div className="migration-bulk-actions">{['同步', '暂停', '删除', '定时同步', '日志下载', '取消定时同步'].map((action) => <button key={action} disabled={!selectedVmIds.length} onClick={() => runMigrationTaskAction(action)}>{action}</button>)}<span>已选择 {selectedVmIds.length}</span></div><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入虚拟机 ID、名称或目标 IP" /></label><button onClick={() => { setQuery(''); setStatusFilter('全部'); }}>↻</button></div>
        <div className="migration-vm-table-wrap"><table className="migration-vm-table"><thead><tr><th><input type="checkbox" aria-label="选择全部迁移任务" checked={visibleVmTasks.length > 0 && visibleVmTasks.every((task) => selectedVmIds.includes(task.id))} onChange={(event) => setSelectedVmIds(event.target.checked ? Array.from(new Set([...selectedVmIds, ...visibleVmTasks.map((task) => task.id)])) : selectedVmIds.filter((id) => !visibleVmTasks.some((task) => task.id === id)))} /></th><th>虚拟机 ID</th><th>虚拟机名称</th><th>操作系统版本</th><th>迁移方案</th><th>任务创建状态</th><th>风险项</th><th>目标 IP</th><th>功能操作</th></tr></thead><tbody>{visibleVmTasks.length ? visibleVmTasks.map((task, index) => { const creation = creationByVm.get(task.name); const riskCount = risks.filter((risk) => !risk.closed && (risk.stage === 'research' || risk.stage === 'planning')).slice(index % 2, index % 2 + 2).length; const os = creation?.os ?? (index % 3 === 0 ? 'Debian GNU/Linux 11' : index % 3 === 1 ? 'CentOS 7 (64 位)' : 'Windows Server 2019'); return <tr key={task.id}><td><input type="checkbox" aria-label={`选择 ${task.name}`} checked={selectedVmIds.includes(task.id)} onChange={(event) => setSelectedVmIds((ids) => event.target.checked ? [...ids, task.id] : ids.filter((id) => id !== task.id))} /></td><td><strong>{task.id}</strong></td><td>{task.name}</td><td>{os}</td><td><span className="agentless-tag">免代理</span></td><td><span className={`creation-state ${isCreated(task.name) ? 'created' : ''}`}><i />{isCreated(task.name) ? '已创建' : '未创建'}</span></td><td>{riskCount ? <span className="vm-risk-count">{riskCount} 项</span> : '—'}</td><td>{task.targetIp}</td><td><div className="migration-row-actions"><button className="detail" onClick={() => setSelectedVm(task)}>查看明细</button>{['同步', '暂停', '删除', '定时同步', '日志下载', '取消定时同步'].map((action) => <button key={action} onClick={() => runMigrationTaskAction(action, task.id)}>{action}</button>)}</div></td></tr>; }) : <tr><td className="empty-row" colSpan={9}>{batches.length ? '暂无符合条件的虚拟机' : '完成规划设计后显示迁移任务'}</td></tr>}</tbody></table></div>
        <div className="vm-table-foot"><span>总条数：{visibleVmTasks.length}</span><div><button>10 / 页⌄</button><button>‹</button><b>1</b><button>›</button></div></div>
      </>}
    </aside>
  </div>;
}

function RiskPanel({ projectId, risks, projectExists, onCloseRisk }: { projectId: string; risks: RiskItem[]; projectExists: boolean; onClose: () => void; onCloseRisk: (id: number, closureDescription: string) => void }) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('全部');
  const [closingRiskId, setClosingRiskId] = useState<number | null>(null);
  const [closureDescription, setClosureDescription] = useState('');
  const visible = risks.filter((risk) => (level === '全部' || risk.level === level) && `${risk.description}${stageName[risk.stage]}${risk.batchId}${risk.vmName}${risk.vmId}`.toLowerCase().includes(query.toLowerCase()));
  const highOpen = risks.filter((risk) => risk.level === '高' && !risk.closed).length;
  const closedCount = risks.filter((risk) => risk.closed).length;
  function confirmClosure(event: FormEvent) {
    event.preventDefault();
    if (closingRiskId === null || !closureDescription.trim()) return;
    onCloseRisk(closingRiskId, closureDescription.trim());
    setClosingRiskId(null);
    setClosureDescription('');
  }
  return <section className="archive-panel risk-panel" aria-label="交付风险清单">
    <header><div><h2>交付风险</h2><span>{highOpen ? `${highOpen} 项高风险需要处理，闭环后可推进到下一阶段。` : risks.length ? '高风险已闭环，可以继续推进。' : '完成评估后，在这里查看风险与处理建议。'}</span></div></header>
    {risks.length > 0 && <section className="risk-overview" aria-label="项目风险闭环概况">
      <header><h3>项目风险闭环</h3><span>{closedCount} / {risks.length} 项已完成</span></header>
      <div className="risk-closure-track" aria-hidden="true">
        {closedCount > 0 && <i className="closed-segment" style={{ flex: closedCount }} />}
        {risks.length > closedCount && <i className="open-segment" style={{ flex: risks.length - closedCount }} />}
      </div>
      <div className="risk-chart-legend"><span><i />已闭环 {closedCount}</span><span><i />待闭环 {risks.length - closedCount}</span><span>高风险待处理 {highOpen}</span></div>
    </section>}
    <div className="risk-toolbar"><label><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索风险、批次或虚拟机" aria-label="搜索交付风险" /></label><div>{['全部', '高', '中', '低'].map((item) => <button key={item} className={level === item ? 'active' : ''} aria-pressed={level === item} onClick={() => setLevel(item)}>{item === '全部' ? '全部' : `${item}风险`}</button>)}</div></div>
    <div className="risk-list">{visible.length ? visible.map((risk) => <article className={`risk-item ${risk.closed ? 'is-closed' : ''}`} key={risk.id}>
      <div className="risk-item-heading"><span className={`risk-severity level-${risk.level}`}>{risk.level}</span><h3>{risk.description}</h3><button disabled={risk.closed} onClick={() => { setClosingRiskId(risk.id); setClosureDescription(''); }}>{risk.closed ? '已闭环' : '处理风险'}</button></div>
      <div className="risk-item-meta"><span>R-{String(risk.id).padStart(3, '0')}</span><span>{stageName[risk.stage]}</span><span>{risk.batchId}</span><span>{risk.closed ? <><Icon name="check" size={12} /> 已闭环</> : '待闭环'}</span></div>
      <details className="risk-item-details"><summary>查看影响范围与记录 <Icon name="chevron" size={12} /></summary><dl><div><dt>虚拟机</dt><dd>{risk.vmName} · {risk.vmId}</dd></div><div><dt>闭环说明</dt><dd>{risk.closed ? risk.closureDescription : '尚未填写'}</dd></div>{risk.closed && <div><dt>闭环时间</dt><dd>{risk.closedAt}</dd></div>}</dl></details>
      {closingRiskId === risk.id && <form className="inline-risk-form" onSubmit={confirmClosure}><label htmlFor={`closure-${projectId}-${risk.id}`}>处理措施与验证结果</label><textarea id={`closure-${projectId}-${risk.id}`} value={closureDescription} onChange={(event) => setClosureDescription(event.target.value)} placeholder="说明采取的措施、验证结果或闭环依据…" maxLength={300} autoFocus required /><div><span>{closureDescription.length} / 300</span><button type="button" onClick={() => setClosingRiskId(null)}>取消</button><button type="submit" className="primary" disabled={!closureDescription.trim()}>确认闭环</button></div></form>}
    </article>) : <p className="inline-empty">{projectExists ? '没有符合条件的风险。' : '先创建项目并完成评估。'}</p>}</div>
  </section>;
}
