# InspireStudio｜灵感工坊

InspireStudio 是一个面向创作者的多模态创意工作台原型。项目以统一首页为入口，提供文案、视觉、音频和视频四个工坊，并围绕本地作品保存、历史版本恢复、媒体处理与视频历史记录可靠性进行实现和验证。

> **当前版本说明：本仓库展示的是可运行的本地演示实现，不应将模板演示描述为真实 AI 生成服务。** 截至当前代码，尚未接入真实 LLM、图像生成、云端 TTS/ASR 或 AI 视频生成 API。各工坊的能力边界见下文。

## 功能概览

| 模块 | 当前代码中可运行的能力 | 当前限制 |
|---|---|---|
| 创意首页与导航 | 首页入口、四大工坊导航、系统连接状态页 | 主要用于进入本地演示模块 |
| 文案工坊 | 选择创作类型、填写主题/受众/语气/要点；本地模板生成演示文案；编辑、复制、保存和恢复版本 | 使用本地模板，不调用 AI API；草稿和版本保存在当前浏览器 |
| 视觉工坊 | 选择创作类型、用途、主题、描述、风格和比例；生成本地 SVG 图形模板；保存、恢复作品 | 不调用图像生成 API；描述不会被模型理解或生成真实对应物体 |
| 音频工坊 | 浏览器本机语音试听；导入音频、解码、裁剪、音量调整并导出 WAV；手动整理转写文本；保存历史 | TTS 使用浏览器本机声音，不是 AI 配音 API；ASR 未接入识别服务，示例文本不是识别结果 |
| 视频工坊 | 选择主题、风格、比例（16:9、9:16、1:1）和时长（15/30/60 秒）；生成 Canvas 本地动态图形模板；预览、播放、暂停、进度控制、保存与恢复；录制导出 WebM | 不调用 AI 视频服务；当前导出为 WebM，不支持应用内 MP4 导出；模板不生成实景画面或配音 |
| 历史记录可靠性 | 视频历史数据校验、并发写入保护、跨标签页消息同步、媒体诊断相关逻辑 | 以仓库中的实现和自动化测试为准；浏览器本地数据不等同于云端账号同步 |

### 数据保存范围

- 文案版本使用当前浏览器的本地存储。
- 视觉作品使用当前浏览器的本地存储。
- 音频作品及媒体数据使用浏览器 IndexedDB。
- 视频作品历史使用浏览器 IndexedDB，并包含跨标签页刷新/同步相关处理。
- 这些数据不会自动同步到云端账号。清除浏览器站点数据可能导致本地作品丢失；重要内容请先导出或备份。

## 技术栈

- **前端：** React、TypeScript、Vite。
- **前端质量检查：** TypeScript build、Oxlint。
- **浏览器能力：** Local Storage、IndexedDB、Web Audio API、SpeechSynthesis、Canvas、MediaRecorder、BroadcastChannel。
- **后端：** Python、FastAPI、SQLAlchemy、SQLite、Uvicorn。
- **测试：** Node.js 内置测试运行器（前端 .test.ts 文件）、pytest（后端）。

前端依赖和脚本以 [frontend/package.json](frontend/package.json) 为准；后端依赖见 [backend/requirements.txt](backend/requirements.txt) 和 [backend/requirements-lock.txt](backend/requirements-lock.txt)。

## 仓库结构

~~~text
InspireStudio/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── WritingWorkshop.tsx
│   │   ├── VisualWorkshop.tsx
│   │   ├── AudioWorkshop.tsx
│   │   ├── VideoWorkshop.tsx
│   │   ├── *Service.ts
│   │   ├── *Storage.ts
│   │   └── videoHistory*.ts
│   ├── tests/
│   ├── package.json
│   └── package-lock.json
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── core/
│   │       └── database.py
│   ├── tests/
│   ├── requirements.txt
│   └── requirements-lock.txt
├── docs/
│   └── architecture.md
└── README.md
~~~

说明：docs/architecture.md 是架构设计文档，包含规划中的模块和接口设想；其中的规划内容不代表这些功能或 API 已全部实现。实际实现以 frontend/src 和 backend/app 当前代码为准。

## 环境要求

- Windows 10/11（以下命令以 PowerShell 为例）。
- Node.js：建议使用 Node.js 26；当前项目的 TypeScript 测试文件已在 Node.js 26.13.0 环境下运行。
- npm：随 Node.js 安装。
- Python：安装可运行当前后端依赖的 Python 版本。
- Git：用于克隆仓库。

## 本地运行

### 1. 克隆仓库

~~~powershell
git clone https://github.com/kirayang0717-cpu/InspireStudio.git
cd InspireStudio
~~~

### 2. 安装前端依赖

~~~powershell
cd frontend
npm.cmd ci
~~~

### 3. 安装后端依赖

打开另一个 PowerShell 窗口，在仓库根目录执行：

~~~powershell
cd backend
python -m venv .venv
.\\.venv\\Scripts\\python.exe -m pip install -r requirements-lock.txt
~~~

### 4. 启动后端

在后端目录的 PowerShell 窗口执行：

~~~powershell
.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
~~~

后端启动时会初始化本地数据目录和 SQLite 数据库文件。当前后端提供的健康检查接口为：

- 健康检查：<http://127.0.0.1:8000/api/health>
- FastAPI 文档：<http://127.0.0.1:8000/docs>

健康检查成功时返回数据库连接状态。当前后端范围以健康检查和数据库连通性验证为主，不能据此认为四大工坊已由后端 AI API 驱动。

### 5. 启动前端

在前端目录的 PowerShell 窗口执行：

~~~powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
~~~

浏览器打开：<http://127.0.0.1:5173>

在页面顶部导航中可进入创意首页、四大工坊和系统连接页。关闭服务时，在对应终端按 Ctrl+C。

## 构建与检查

在 frontend 目录运行：

~~~powershell
npm.cmd run build
npm.cmd run lint
~~~

当前 frontend/package.json 定义的脚本为 dev、build、lint 和 preview，**没有定义 npm test 脚本**。

### 运行前端定向测试

在 frontend 目录、Node.js 26 环境中运行：

~~~powershell
node --test .\\tests\\videoHistorySync.test.ts
~~~

该命令用于运行视频历史跨标签页同步测试。开发验收过程中，该文件曾报告 24 项测试通过；这不等同于整个项目所有测试均已通过。仓库中的其他测试文件可根据需要使用 Node.js 测试运行器分别执行。

### 运行后端测试

在 backend 目录执行：

~~~powershell
.\\.venv\\Scripts\\python.exe -m pytest -q
~~~

测试结果以实际运行输出为准。

## 后端接口与数据目录

当前后端入口为 backend/app/main.py，提供：

- GET /api/health：检查 SQLite 数据库连接。
- CORS 允许来源：http://localhost:5173 和 http://127.0.0.1:5173。
- 数据库文件默认位于仓库根目录下的 data/database/inspirestudio.db。
- 启动时会创建 data/database、data/uploads、data/assets、data/exports 和 data/temp 目录。

data/、虚拟环境、依赖目录、构建产物、日志和本地环境配置不应提交到仓库；具体忽略规则见根目录 .gitignore。

## 已知限制与复现提示

1. **AI 服务尚未接入：** 文案和视觉为本地模板演示；音频配音使用浏览器本机语音，语音转写不执行真实识别；视频为 Canvas 本地动态图形模板。请勿将这些演示描述为已接入真实 AI 模型。
2. **本地数据不云同步：** 作品和历史记录保存在当前浏览器的 Local Storage / IndexedDB 中，换浏览器或清理站点数据后不保证可恢复。
3. **视频导出格式：** 应用内视频录制导出为 WebM；本仓库当前代码不提供应用内 MP4 导出。
4. **后端范围：** 当前后端主要用于 SQLite 初始化、数据库连通性和健康检查，尚不是四大工坊的完整业务 API 后端。
5. **版本历史粒度：** 项目早期 Git 提交包含较大范围的整体快照，细粒度迭代记录存在局限。README 的更新不会改变或补造历史提交。
6. **AI 协作原始记录：** 已整理的公开消息摘录不等于完整的原生聊天导出，也不包含全部工具调用日志。

## 项目资料

- [技术架构设计](docs/architecture.md)
- [前端依赖与脚本](frontend/package.json)
- [后端依赖](backend/requirements.txt)
- [后端锁定依赖](backend/requirements-lock.txt)

---

**项目状态：** 本仓库用于展示 InspireStudio 当前可运行的前端工坊演示、浏览器本地作品管理、视频历史可靠性实现，以及基础后端连接检查。具体能力边界请以代码和本 README 的限制说明为准。
