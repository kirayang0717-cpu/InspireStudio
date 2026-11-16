# InspireStudio Phase 5：音频工坊开发报告

日期：2026-11-15
项目：D:\InspireStudio
状态：第一版开发与自动检查完成，真实浏览器人工验收待进行。

## 开发前检查与规格核对

读取架构、Phase 1/4 报告、现有前端路由、文案与视觉服务/存储、后端及数据库初始化代码；检索 docs 与此前《AI创新应用挑战赛》对话。既定音频方向是文本配音、语音转写、声音编辑，基础编辑包含裁剪与音量调整。

Phase 2 报告不存在，仅保留 frontend/phase2-backup-20261115-194411；没有覆盖原文件或补写未经证实的历史。项目没有 .git，无法报告分支和 Git 差异。SQLite 只读检查业务表列表为空。后端仅 /api/health，没有 TTS、ASR 或媒体处理接口。

文案与视觉均已完成首版并在此前对话中得到用户验收。两者使用独立 localStorage key，本次不修改其源码或持久化行为。旧文件校验记录和 App.tsx 备份保存在 data/temp/phase5-baseline；最后比对所有记录中的文件，除计划修改的 App.tsx 外均保持原哈希，包括旧文档与后端源码。

## 实施阶段与结果

1. 音频基础模块：校验文件扩展名与大小，浏览器解码，真实 PCM 裁剪、增益与限幅，编码 PCM16 WAV。阶段 build/lint 通过，5 项音频测试通过。
2. 页面接入：三个面板、浏览器本机声音试听、非识别示例文本与手动编辑复制、原始/处理后音频播放器、WAV 下载。阶段 build 通过，音频与视觉 10 项测试通过。lint 首次出现两条新增组件提示，已修复，复跑无警告。
3. 独立历史与回归：IndexedDB 存 Blob 与参数，每次保存独立版本，支持恢复、删除、失败提示。最终 build/lint 通过，12 项前端测试通过，3 项后端测试通过。

## 文件变更

新增：
- frontend/src/AudioWorkshop.tsx：三个方向的界面、播放器、试听及历史操作。
- frontend/src/AudioWorkshop.css：米白与深绿样式，850px 单列面板、450px 小屏布局。
- frontend/src/audioService.ts：文件检查、浏览器解码、裁剪与音量处理、WAV 编码、带声明的转写示例。
- frontend/src/audioStorage.ts：inspirestudio.audio.v1 IndexedDB，独立 works 对象仓库。
- frontend/tests/audio.test.ts：5 项音频数据与输入校验测试。
- frontend/tests/audioStorage.test.ts：2 项持久化测试，覆盖三个方向、音频字节恢复、删除及不可用存储。
- docs/phase5-report.md：本报告。

修改：
- frontend/src/App.tsx：只新增音频组件导入与 audio 路由分支。
- frontend/package.json、frontend/package-lock.json：新增测试用开发依赖 fake-indexeddb，未新增运行时依赖。
- frontend/dist：正常 build 生成产物。

所有项目文件、依赖和此次 npm 缓存均位于 D 盘项目中。浏览器存储由浏览器管理，不等同于 D 盘普通文件；作品可导出到用户选择的目录。

## 能力边界

### 文本配音
本地演示，未接入 AI API。动态列出浏览器可用的 localService 本机声音，支持语速、音高和语气；语气通过音高系数近似调整，不保证情感。声音列表异步更新，无本机声音时禁用试听并提示。停止、修改、切换与离开页面会取消语音。保存文字及设置，恢复后重新试听，不生成或下载伪造的配音文件。

声音支持参考：https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices

### 语音转写
没有 ASR API，不会识别音频。用户选择文件后仅导入浏览器，可播放、手动输入与复制。按钮明确为“填入演示文本（非识别）”，文本本身也带非识别标记；不是文件内容或真实识别结果。保存导入音频、编辑文本与模式。

### 声音编辑
真实本地处理：导入、裁剪开始/结束秒数、0–200% 音量、原音试听、处理后试听、PCM16 WAV 下载。修改参数后清除旧处理结果，避免导出与参数不一致。增益超过 100% 可能限幅失真。支持单/双声道、最长 5 分钟、20 MB；WAV、MP3、M4A、OGG、WebM、FLAC 是否可解码取决于浏览器。损坏或不支持的文件会失败，不会伪造处理成功。输出采用浏览器解码采样率，未保留压缩格式或元数据；本版无 MP3 编码、时间线、降噪或多轨。

解码支持参考：https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData

### 历史
独立 IndexedDB，不占用文案/视觉 localStorage key。事务完成后才报告保存成功，每条记录包括导入 Blob、处理后 Blob（如有）、文字和设置；恢复会还原这些内容。未保存时切换面板、导入或恢复会询问替换。未保存内容离开页面会丢失。仅当前浏览器与同一来源有效，localhost 与 127.0.0.1 数据各自独立；清除浏览器数据会丢失。历史没有云同步或固定容量上限，大文件与多版本会占浏览器空间，空间不足时保存失败并提示导出，不会自动清除旧作品。配音仅保存文字设置；转写为演示/手动文本；编辑保存音频及参数。

## 测试结果

前端 build：通过。lint：通过，无警告。
前端测试：12 passed（音频 5、音频存储 2、视觉 5）。存储测试使用 fake-indexeddb，验证重开连接后数据与 Blob 字节保持一致；不等同真实浏览器 F5 端到端验收。
后端 pytest：3 passed；1 条已有 Starlette/httpx 弃用提示。
npm 安装审计：0 vulnerabilities。
前端 AudioWorkshop.tsx 服务请求：HTTP 200；5173 与 8000 已有服务监听，未重启服务。
浏览器自动控制入口不可用（无可用浏览器，原生应用入口启动失败），未完成真实声音试听、文件选择/下载点击、F5 按键、剪贴板或小屏截图验收。响应式 CSS 已实现但目视验收仍待进行。

## VS Code 自动检查

阶段一：
```powershell
cd D:\InspireStudio\frontend
npm.cmd run build
npm.cmd run lint
node --test tests/audio.test.ts
```
阶段二：
```powershell
cd D:\InspireStudio\frontend
npm.cmd run build
npm.cmd run lint
node --test tests/audio.test.ts tests/visual.test.ts
```
阶段三 / 最终检查：
```powershell
cd D:\InspireStudio\frontend
npm.cmd run build
npm.cmd run lint
node --test tests/audio.test.ts tests/audioStorage.test.ts tests/visual.test.ts
cd D:\InspireStudio\backend
.\.venv\Scripts\python.exe -m pytest -q
```

## 启动与手动验收

现有服务正在运行，可直接打开：
http://127.0.0.1:5173/#/workshops/audio

若前端没有运行：
```powershell
cd D:\InspireStudio\frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```
音频本地工具不依赖后端。系统连接页需要后端：
```powershell
cd D:\InspireStudio\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

1. 文本配音：输入“欢迎来到灵感工坊”，选择可用本机声音，试听并改变语速、语气。停止后应不再播放。无声音时应看到不可用提示。保存，F5 后从历史恢复，文字与参数应一致。
2. 语音转写：导入不超过限制的音频，原音可播放；点击非识别示例按钮，结果必须含示例标记。编辑成自己的文本后复制核对。保存，F5 恢复后文件与文本应一致。
3. 声音编辑：导入一段超过 5 秒的素材，设开始 1、结束 3、音量 50%，应用处理。处理后应约为 2 秒且音量降低。下载 WAV，用本地播放器打开检查。再修改参数，旧处理结果应清除。
4. 编辑历史：处理后保存，F5 恢复，应同时找回原始音频、处理后音频和参数；下载后应与恢复前结果一致。删除测试版本，F5 后应不再出现。
5. 边界：结束小于开始、超出时长或空文件应提示失败；导入失败不应替换已有作品。未保存时切换/恢复应确认。窄屏检查面板单列、按钮可用、没有横向溢出。
6. 回归：访问首页、系统连接、四大工坊导航、文案和视觉页面，确认页面与现有作品可见。无需再次改写或迁移已验收的文案/视觉数据。
