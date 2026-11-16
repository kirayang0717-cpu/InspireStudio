# InspireStudio 本地维护结果

日期：2026-11-16（Asia/Shanghai）
项目：D:\InspireStudio

## 备份与版本基线

维护前项目可访问，共 4,874 个文件、176,918,985 字节（约177 MB）。检查时 C 盘可用59,676,319,744字节，D盘450,435,903,488字节。

完整备份：`C:\Users\Lenovo\Documents\Codex\2026-11-16\referenced-chatgpt-conversation-this-is-an\outputs\InspireStudio-backup-20261116-104729\project`。包含隐藏文件、依赖、缓存、数据库、原阶段备份；没有覆盖原项目。相邻 manifest.csv 记录全部文件的长度与 SHA-256。全部4,874项逐文件比对一致；备份 SQLite 数据库 `PRAGMA integrity_check` 返回 `ok`。校验期间数据库被其他进程占用，默认哈希读取失败，改用共享只读方式后校验成功，没有停止现有服务或改写数据库。备份随后在工作区内移动到 outputs 长期保留。

原目录无 Git，不能据此声称原有工作区 clean；全部原始内容已先完整备份。随后初始化 Git，提交维护前代码和文档基线 `88bd72a`。沿用既有 .gitignore，数据库、依赖、缓存和环境文件不进入提交，但在完整备份中。没有覆盖既有未提交修改，没有部署或推送远端。

项目目录备份不包含浏览器 localStorage/IndexedDB 中的真实作品。此次真实浏览器测试使用独立 Edge 临时会话及127.0.0.1:5174，未读取或修改用户真实浏览器作品。

## 实际确认与修复

### P1-1 未保存编辑离开或刷新丢失

确认 App 的 hash 路由卸载工坊；文案和音频虽有 dirty 标记，却未保护路由/刷新；视觉、视频仅编辑参数时也缺保护。

四工坊增加统一未保存离开/刷新确认。视觉和视频将当前参数与已生成参数比较；保存旧结果不会把新参数标成已保存。路由入口先检查保护，再切换组件。浏览器连续工坊切换实际发现过监听先后顺序缺陷，已修复，并补专门自动回归。首次生成不要求多余的替换确认。

这是离开确认保护，不是自动保存。用户明确确认丢弃仍会丢弃；浏览器崩溃、强制结束进程或浏览器禁止 beforeunload 提示的环境不能由此保证恢复。

### P1-2 多标签保存覆盖

确认文案、视觉原实现从组件初始历史列表整份重写，旧标签能丢失新版本，旧列表操作也可能复活已删版本。

保存/删除在同源 Web Locks 锁中读取最新存储，只加入本次新增版本或移除本次删除编号。继续保留文案20、视觉30条上限及原始格式。读取失败或无跨标签锁能力时拒绝写入，避免不安全覆盖。已有音视频按独立ID写入 IndexedDB 事务，未改成整份替换。

历史面板不会实时同步其他标签；下次操作会基于最新存储合并，刷新可看到最新列表。所有标签需运行新版本；已打开的旧版本页面应刷新后再编辑。

### P1-3 音视频异常历史与恢复

确认原实现 getAll 后直接类型断言并按 savedAt 排序，无运行时校验，缺字段可影响排序/渲染，回调异常可能让 Promise 不结算。

加入元数据、模式、必需文本/参数、数值范围、视频规格和 Blob 类型/非空校验；读取时隔离无效记录并提示，原记录留在 IndexedDB，不自动删除或覆盖。写入前拒绝无效新作品。读取完成回调捕获异常并明确拒绝 Promise。

字节损坏不等于字段损坏：即使 Blob 元数据合法，浏览器仍可能无法解码。媒体播放器增加错误提示，保留文本、动画设置和历史原件；视频可从恢复的设置重新录制，音频可重新导入原素材。没有声称能够修复任意损坏的媒体字节。

## 测试与回归

每个 P1 均先单独运行针对性测试再运行相关回归。首次并发测试的模拟锁异常处理失败、首次浏览器连续导航失败、首次生成出现额外确认均实际记录并修正；以下为最终结果，不沿用历史通过记录。

| 检查 | 最终结果 |
|---|---|
| 前端 node --test tests/*.test.ts | 21通过、0失败（原有16项 + 新增5项） |
| TypeScript应用和Vite配置 | 两项均通过，noEmit、incremental=false |
| Vite生产构建 | 通过，39模块，write:false，未覆盖dist |
| npm run lint | 通过，无前端规范警告 |
| 后端pytest | 3通过；1条已有Starlette/httpx弃用提示 |
| 后端pip check | No broken requirements found |
| HTTP /api/health | status=ok，database=connected |
| git diff --check | 通过；Git提示LF/CRLF转换，不是测试失败 |

真实浏览器使用本机 Edge 无界面独立会话，不是 fake-indexeddb：

- 四工坊分别修改后取消离开、取消刷新，内容保留；确认离开可返回首页。
- 同一页面连续切换四工坊，离开保护全部通过。
- 文案双标签同时保存保留两份；旧标签保存不会复活另一标签已删版本。
- 视觉双标签真实生成并保存，刷新后保留两份作品。
- 音频真实 WAV 导入、裁剪处理、保存、刷新和恢复通过。
- 注入坏 schema 的真实 IndexedDB 记录，列表隔离并提示；注入不能解码的 WebM，恢复保留动画设置并显示安全恢复提示。
- 视频组合16:9/15秒、9:16/30秒、1:1/60秒分别通过：生成、画布尺寸、播放、暂停、回到开头、拖动进度、重新编辑参数保留、完整时长WebM录制、浏览器媒体解码播放、保存、刷新恢复、删除。最终主回归无 pageerror。
- 三种比例画布截图均目视检查，当前中文样例未见异常裁切。截图见 verification/canvas-*.png；主浏览器测试结果见 verification/browser-results.json。

本次覆盖上述三个比例/时长组合，不代表9种比例×时长的全部组合、所有浏览器或所有媒体编码兼容性。WebM验证为录制生成文件及浏览器内播放，未另做操作系统外部播放器验收；本机语音试听和真实AI服务不在本次回归结论内。既有P2问题（例如录制异常终态、音频重置异步竞争、全量Blob列表性能）未在本轮扩展修复。

## 复核命令

frontend目录：

```powershell
node --test tests/*.test.ts
node_modules\.bin\tsc.cmd -p tsconfig.app.json --noEmit --incremental false
node_modules\.bin\tsc.cmd -p tsconfig.node.json --noEmit --incremental false
node --input-type=module -e "import {build} from 'vite'; await build({build:{write:false}})"
npm.cmd run lint
```

backend目录：

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider -q
.\.venv\Scripts\python.exe -B -m pip check
```

维护未修改已有生成/绘制/录制服务或后端业务代码，未安装项目生产依赖，未更改外部服务。浏览器测试工具仅安装在独立维护工作目录。
