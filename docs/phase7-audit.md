# InspireStudio Phase 7 项目质量审查

审查日期：2026-11-16（Asia/Shanghai）
项目：D:\InspireStudio
结论：当前为四工坊本地优先原型，不是真实多模态 AI 平台。现有自动检查通过，但不等于浏览器端验收或持久化可靠性已全面验证。未发现已证实的 P0；存在应先处理的 P1 数据可靠性问题。

## 1. 范围与执行边界

本次仅检查并新增本报告。没有修复业务、重构、安装依赖、调用收费 API、修改用户作品或覆盖既有文档。前端构建采用 write:false，仅在内存生成；TypeScript 禁用增量写入；pytest 禁用字节码和缓存。检查前后比对 frontend/src、tests、dist、docs、backend/app、tests 中共 50 个已有文件，哈希变化 0。源码与已有构建产物均保持不变。

证据分类：
- **本次实测**：命令、HTTP、内存模拟存储复现。
- **代码确认/静态推断**：能指出具体实现路径，但未通过浏览器重现。
- **历史记录**：原阶段报告/此前用户验收，不等于本次重新实测。
- 未操作真实浏览器作品，未完成真实 F5、多标签 UI、音视频播放/录制下载、移动端目视或兼容性矩阵。不能据此声明四工坊全量验收通过。

## 2. 目录与项目现状

已枚举目录及源文件；依赖、缓存内部按用途汇总，避免把数千个第三方文件误作项目业务结构。

```text
D:\InspireStudio
├── .gitignore、README.md
├── docs/
│   ├── architecture.md
│   ├── phase1-report.md
│   ├── phase4-report.md
│   ├── phase5-report.md
│   ├── phase6-report.md
│   └── phase7-audit.md（本次唯一新增）
├── frontend/
│   ├── package.json、package-lock.json
│   ├── vite.config.ts、tsconfig*.json、.oxlintrc.json、index.html
│   ├── src/
│   │   ├── main.tsx、App.tsx、App.css、index.css
│   │   ├── ConnectionStatus.tsx、connection.css
│   │   ├── WritingWorkshop.tsx/.css、writingService.ts、writingStorage.ts
│   │   ├── VisualWorkshop.tsx/.css、visualService.ts、visualStorage.ts
│   │   ├── AudioWorkshop.tsx/.css、audioService.ts、audioStorage.ts
│   │   ├── VideoWorkshop.tsx/.css、videoService.ts、videoStorage.ts
│   │   └── assets/（hero.png、react.svg、vite.svg）
│   ├── tests/（visual、audio、audioStorage、video、videoStorage，共5文件）
│   ├── public/（favicon.svg、icons.svg）
│   ├── phase2-backup-20261115-194411/（原首页/导航备份）
│   ├── node_modules/、dist/
├── backend/
│   ├── app/main.py、app/core/database.py、各 __init__.py
│   ├── tests/test_health.py
│   ├── requirements.txt、requirements-lock.txt
│   └── .venv/、__pycache__/、测试缓存
├── data/
│   ├── database/inspirestudio.db
│   ├── assets/、uploads/、exports/
│   └── temp/（pip/npm 缓存及 phase4/5/6-baseline 备份）
└── .pytest_cache/
```

Phase 2、3 开发报告缺失；Phase 4～6 报告存在且已核对。架构是长期目标，阶段报告大体明确演示边界，不能把架构功能清单视为当前已实现。根 README 仍停留 Phase 1，入口与“四工坊未实现”的说明过时。

Git：git status --short --branch 返回 not a git repository。当前无可审查分支、提交历史或未提交差异，不能称工作区 clean。现有 baseline 是有限文件备份，不等同版本控制或用户作品备份。本次未创建 Git。

## 3. 前后端架构及依赖

### 前端
React + TypeScript + Vite + 普通 CSS。每工坊一个较大的页面组件，独立 service/storage 文件；hooks 状态，无 React Router、Zustand、Tailwind 或 Tiptap。架构中这些工具尚未落地，不属于本次突然缺失的依赖。

App.tsx 使用 hashchange 自制路由：#/、#/connection、#/workshops/writing、visual、audio、video；未知地址显示不存在页。静态核对现有导航目标正确，四工坊标签一致。查询参数在 hash 外不影响路由；尾斜杠、hash 内查询参数没有规范化。工坊组件随导航卸载，未保存状态不跨页面保留。

package.json：dev=vite；build=tsc -b && vite build；lint=oxlint；preview=vite preview；没有 test 脚本、CI 或 engines 声明。测试直接调用 node --test，依赖 Node 对 TypeScript 的直接加载支持。当前 Node v26.13.0（前阶段环境），本次测试执行成功；未验证旧 Node。

本次 npm ls --depth=0：react/react-dom 19.3.1；typescript 7.0.2；vite 8.3.8；@vitejs/plugin-react 6.3.0；oxlint 1.93.0；fake-indexeddb 6.2.8；@types/node 24.19.2，@types/react/react-dom 19.3.0。声明范围与安装版本存在正常的范围内差异，有 package-lock。fake-indexeddb 仅测试使用。未进行本次在线漏洞库审计，不沿用旧“0 vulnerabilities”作为当前安全结论。

### 后端与接口
Python + FastAPI + Uvicorn + SQLAlchemy + SQLite，独立 .venv。requirements.txt 未固定版本；requirements-lock.txt 有冻结版本，README 默认安装未锁定列表，存在重装漂移风险。pip check 本次通过。

业务接口仅 GET /api/health，正常返回 status=ok、database=connected；数据库异常返回 503，不返回私密异常详情。/docs、/openapi.json 是框架文档。没有 /api/v1 工坊 API、项目 API、模型调度、任务 worker、素材上传或 FFmpeg 合成服务。

SQLite 初始化只创建目录并 SELECT 1。只读检查 sqlite_master：业务表列表为空。四工坊作品均不存入 SQLite，健康检查“数据库正常”不能证明作品已保存。

浏览器端唯一实际 HTTP 业务请求是 ConnectionStatus.tsx 中硬编码 http://127.0.0.1:8000/api/health，有5秒超时及结果校验。四工坊不调用后端生成接口。

## 4. 四工坊与 AI 能力清单

| 工坊 | 当前实现 | 持久化与刷新 | 与产品目标差距/分类 |
|---|---|---|---|
| 文案 | 五类型、主题/受众/语气/篇幅/要点、模板文案、纯文本编辑、复制、草稿版本恢复删除 | localStorage inspirestudio.writing.v1，最多20版本；刷新后需手动载入 | **本地模板，非AI**。没有真实生成/改写模型、Tiptap富文本或TXT下载 |
| 视觉 | 类型用途、主题描述、四风格、三比例、SVG演示、预览再生成、下载与历史 | localStorage inspirestudio.visual.v1，最多30版本；保存种子与原设置重建 | **本地SVG模板，非AI**。描述不绘制为物体，无参考图、多候选、真实文生图、海报编辑 |
| 音频 | 本机声音试听与语速/音高/语气；导入音频、示例转写编辑复制；真实裁剪/增益/WAV导出 | 独立 IndexedDB inspirestudio.audio.v1，保存文字参数及原始/输出Blob | **浏览器本机TTS、Web Audio处理**；ASR是标记示例/手动输入。没有AI TTS/ASR、配音录音下载、MP3编码 |
| 视频 | 三比例、15/30/60秒、主题描述与三风格、Canvas时间轴播放暂停拖动、WebM录制、历史 | 独立 IndexedDB inspirestudio.video.v1；动画设置与可选WebM Blob | **本地图形动画+浏览器录制，非AI**。没有实景生成、AI分镜、素材/音轨/字幕编辑、FFmpeg或MP4 |

**真实接入的 AI 能力：0。** 本机语音可能由操作系统语音技术实现，但不等同项目接入 AI API。生成/预览页面均有演示或未连接说明，SVG及视频画面带非AI标识，没有发现实际调用收费模型的路径。首页仍用“灵感生图/脚本分镜/字幕编辑”等目标标签，容易高估能力，应增加当前可用范围提示。

## 5. 持久化可靠性

正面：文案有字段修复、坏数据备份后再写；视觉有字段校验及坏数据备份。localStorage 写失败不更新内存列表并提示。音视频使用独立 IndexedDB 事务，事务完成才报告保存成功；Blob跨连接恢复测试通过。已有删除均有确认，快照通常独立保留，不覆盖原版本。

局限：
- 所有作品受同源浏览器存储约束，localhost/127.0.0.1、端口或浏览器不同就不是同一作品库。SQLite正常不代表浏览器数据可用。
- 没有自动保存、统一导入导出/备份恢复或浏览器持久存储申请；删除浏览器数据、隐私模式、配额不足/回收仍可能丢失。阶段UI已提示部分限制。
- 文案20条与视觉30条的截断是设计行为，保存新版本会自动舍弃最旧版本，没有对即将移除项的单独确认。
- 原用户验收是正常单页路径通过，不覆盖下面的多页面及异常路径。本次未读取或更改用户真实浏览器作品。

## 6. 问题与优先级

P0=已证实紧急破坏/泄露；P1=数据可靠性或核心流程高影响；P2=局部正确性/兼容性/维护；P3=低影响体验/文档。以下未修复。

| ID/级别 | 证据与触发 | 影响与建议 |
|---|---|---|
| A01 P1 | WritingWorkshop.tsx:21–28、VisualWorkshop.tsx:26–33 持有初始化列表，保存/删除整体重写；无 storage 同步或冲突合并 | 多标签页后写覆盖前页的新版本，旧页删除也可能复活已删记录。**内存复现**：A/B均读空，A存tab-A，B存tab-B，最终仅tab-B。视觉同模式为静态确认。建议写前合并、并发策略与冲突回归 |
| A02 P1 | audioStorage.ts:18–19、videoStorage.ts:19–20 的 getAll 后直接类型断言，随后 sort；无运行时字段校验 | 缺字段/旧schema可能使列表渲染崩溃；savedAt异常还可能在事件回调抛错，使外层Promise不能正常结算。**内存复现**视频put接受仅id/savedAt的非法作品；页面崩溃与Promise挂起为静态推断。建议校验隔离坏记录、恢复提示、迁移及回调异常捕获 |
| A03 P1 | App.tsx hash导航卸载组件，四工坊无全局离开保护；视觉/视频表单修改不更新dirty，只针对生成结果标记 | 未保存文字、提示词、音频编辑离开工坊/F5后丢失；已保存结果基础上改表单再恢复/生成也可能不确认。虽已有部分提示，仍建议统一未保存状态及路由/关闭保护；不修改已验收存储格式 |
| A04 P2 | AudioWorkshop.tsx“重置编辑”：异步decode没有busy或请求标识 | 重置解码未完成就导入/恢复另一作品，旧请求可能把旧时长写入新作品，清除新输出。静态推断，建议绑定作品请求代次及禁用/取消 |
| A05 P2 | audioStorage.ts、videoStorage.ts每次list/put/delete都getAll含全部Blob；没有分页、容量统计或清理策略 | 多个长音视频/版本可能导致内存与存储压力；列表初始请求与后续写请求也没有代次隔离，旧列表可覆盖新UI（不等同已提交磁盘数据丢失）。建议先元数据分页、容量提示再设计清理 |
| A06 P2 | videoService.ts:51录制定时回调直接drawVideo/progress；无try/catch及独立终止超时；onerror只清理定时器 | 绘制/回调异常或录制事件异常时，可能一直busy、资源清理不完整；录制只按非空Blob判成功，无实际时长/解码校验。静态推断。建议终态统一处理、异常注入测试与真实媒体验收 |
| A07 P2 | visualService.ts的固定720×720 viewBox及preserveAspectRatio=none | 16:9/9:16导出会拉伸圆形、文字，尺寸测试虽通过但视觉比例失真。代码确认，需真实截图核对；建议按目标画布布局 |
| A08 P2 | AudioWorkshop.tsx直接navigator.clipboard.writeText；ConnectionStatus.tsx使用AbortSignal.timeout；audioService.ts直接AudioContext | 在缺少API的浏览器，复制可能在Promise建立前同步抛错，其他能力缺失提示不统一；本机声音、音频解码、WebM也受浏览器制约。视频有录制能力检测，但无真实兼容矩阵。建议特性检测与降级 |
| A09 P2 | 现有5个前端测试文件没有文案专属测试；音视频存储为fake-indexeddb，视频Blob为测试字符串 | 缺少真实F5、路由、多标签、损坏schema、配额、解码、取消/错误录制测试。16通过不能证明这些可靠。建议优先围绕A01/A02增回归与浏览器冒烟 |
| A10 P2 | Git不可用、无CI/test脚本/Node版本约束；Python默认安装未锁版本 | 回滚、可重复验收与多人协作不足。建议经用户确认初始化版本基线、明确版本及验证入口，保留用户文件 |
| A11 P3 | 音视频storage几乎复制、四套panel/表单/状态/确认样式；VideoWorkshop多行压缩成单行 | 修改一致性差、调试困难。建议在保护行为测试后再小范围抽取；本轮不做重构 |
| A12 P3 | Phase2/3报告缺失，README停留初始化；首页目标标签与实际功能不完全对应 | 补能力矩阵与运行说明，明确历史文档缺失而不是伪造报告 |

P0：本次未发现已证实问题；有限审查不构成不存在漏洞的保证。P1三项建议在增加跨工坊新功能前处理。

## 7. 接口、安全与兼容性

本次HTTP实测：5173首页200；8000/api/health 200且返回数据库connected；8000/openapi.json 200，业务paths只有/api/health。服务监听127.0.0.1。没有发现现有导航错误目标；未实测点击与焦点切换。

CORS仅允许两个5173本地来源，GET、Content-Type，无凭据；非允许来源测试通过。该配置是本地开发边界，不是鉴权；未来提供敏感API/对外部署必须重新评估。无认证、授权、TLS、部署安全头/CSP配置，不应把当前开发服务直接当生产发布方案。当前只有只读健康接口，不能仅因缺认证将其定为P0。

源码未见API密钥或真实模型调用；本次未读取全盘秘密，也未运行在线漏洞数据库扫描。React纯文本显示与SVG XML转义减少输入注入路径，未使用任意HTML注入或系统命令执行。音频只本地导入，无服务器上传；扩展名/20MB校验后还需浏览器解码，5分钟限制在解码后检查，压缩文件仍可能先消耗较大资源。未来后端接入要独立做上传/路径/大小防护，不能沿用前端校验当安全边界。

响应式CSS存在850/450等断点；:has、Web Speech、Web Audio、MediaRecorder、剪贴板API和安全上下文要求需真实浏览器确认。本次未给出“所有浏览器兼容”结论。

## 8. 自动化验证结果及复核方式

| 项目 | 本次结果 |
|---|---|
| TypeScript应用与Vite配置检查 | 两项均exit 0，noEmit、incremental=false |
| Vite生产构建 | write:false内存构建成功，35模块；不覆盖dist |
| oxlint | 通过，无输出警告 |
| 前端现有测试 | 16 passed、0 failed |
| 后端pytest | 3 passed，1条已有Starlette/httpx弃用提示 |
| pip check | No broken requirements found |
| SQLite只读结构检查 | 表列表[] |
| 已有文件校验 | 50个文件，0变化 |

后端是解释型工程，没有独立build或Python lint配置，本次不声称后端lint通过；pytest覆盖健康、外键、CORS和数据库异常，不覆盖不存在的工坊API。前端未重新执行会写dist的npm run build，但分别通过其TypeScript与Vite实际构建步骤。

不写构建产物的复核命令（frontend目录）：
```powershell
.\node_modules\.bin\tsc.cmd -p tsconfig.app.json --noEmit --incremental false
.\node_modules\.bin\tsc.cmd -p tsconfig.node.json --noEmit --incremental false
node --input-type=module -e "import {build} from 'vite'; await build({build:{write:false}})"
npm.cmd run lint
node --test tests/audio.test.ts tests/audioStorage.test.ts tests/video.test.ts tests/videoStorage.test.ts tests/visual.test.ts
```
后端目录：
```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider -q
.\.venv\Scripts\python.exe -B -m pip check
```
额外复现只使用内存Map与fake-indexeddb，未触碰真实浏览器localStorage/IndexedDB。

## 9. 下一阶段建议（待用户确认后执行）

1. 先处理A01/A02/A03：数据并发、坏历史隔离、未保存保护。先确定复现用例与验收标准，保留现有数据格式和正常保存/恢复行为。
2. 增加浏览器正常/错误路径验收，覆盖F5、两标签、存储拒绝与音视频实际录制；随后修复音频重置竞争与视频终态处理。
3. 建立Git基线与统一测试入口，补版本约束、当前能力说明和依赖审计；任何初始化/改动另行确认。
4. 在可靠性达标后，再决定真实AI供应商、后端资产持久化与跨工坊流程。收费API、迁移和批量重构均不在本次授权内。

本轮止于报告，不修复上述问题，等待用户确认。
