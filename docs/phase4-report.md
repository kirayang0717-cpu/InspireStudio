# Phase 4：视觉工坊第一版开发报告

日期：2026-11-15
项目：D:\InspireStudio

## 检查发现与保护范围
- 已读取 architecture.md、phase1-report.md、README、前后端实现以及文案工坊组件、样式、服务和存储。
- docs 没有 Phase 2 报告；frontend/phase2-backup-20261115-194411 是已有页面备份，未修改，也未编造阶段验收结论。
- 项目不是 Git 仓库，无可报告的当前分支及 Git 工作区差异。没有初始化 Git 或创建提交。
- 实际技术栈为 React + TypeScript + Vite + 普通 CSS；架构中的 Tailwind/Tiptap/Zustand 尚未接入。后端 FastAPI 仅提供健康检查，无图像生成 API。
- 文案使用 inspirestudio.writing.v1 本地浏览器存储；已验收的保存、刷新、版本恢复与删除功能全部保持原实现。
- 修改前源文件哈希及 App.tsx 备份在 data/temp/phase4-baseline。修改后核对所有原 src 根目录文件，除 App.tsx 外均保持原哈希。首页、公共导航、系统连接、文案工坊和后端源码均未改写。

## 实施与交付
按独立页面、服务适配器、存储模块实现，仅向已有 Hash 路由加入视觉页面分支，四大工坊导航沿用原结构。

新增文件：
- frontend/src/VisualWorkshop.tsx：类型、用途、主题、描述、四种风格、三种比例、生成、预览、编辑提示词、保存、下载、历史恢复与删除。
- frontend/src/VisualWorkshop.css：米白、深绿、低饱和配色，850px 单列布局、450px 历史单列。
- frontend/src/visualService.ts：纯本地 SVG 图形模板适配器，主题文字 XML 转义，明确 source=demo。
- frontend/src/visualStorage.ts：独立 inspirestudio.visual.v1 存储，最多 30 个手动保存版本；保存生成时的设置与随机种子，恢复可重建相同图像。损坏数据保存前备份，空间不足时显示下载提示。
- frontend/tests/visual.test.ts：自动测试。
修改文件：frontend/src/App.tsx（仅导入与视觉路由分支）。

演示边界：没有调用任何 AI API。画面描述和用途只记录，不会解析成实际视觉内容。主题用于模板文字，风格影响配色，比例影响画布，重新生成改变图形构图。页面、结果和下载 SVG 都标注非 AI 生成。此版不包含参考图、真实文生图、多候选或海报可视化排版，后续可替换服务适配器，密钥应保存在后端。

保存行为：手动保存，未保存结果离开页面会丢失；每次保存一个独立版本，超过 30 个移除最旧版本。仅当前浏览器、当前来源有效，不同步云端。修改设置不改变旧预览，保存始终保存生成时的快照。替换未保存结果或删除历史版本会确认。下载为带演示标识的 SVG。

## 验证
- npm.cmd run build：通过（TypeScript + Vite）。
- npm.cmd run lint：通过，无输出错误。
- node --test tests/visual.test.ts：5 passed。覆盖空输入、比例尺寸、XML 转义与演示水印、提示词快照、保存/重新读取/版本/删除、文案 key 隔离、损坏数据备份与存储异常。
- backend/.venv python -m pytest -q：从 backend 目录运行，3 passed；1 条已有 Starlette/httpx 弃用提示。首次从项目根目录调用测试导致 app 导入失败，切换正确目录后通过，无需修改后端。
- 已有前端服务 http://127.0.0.1:5173 返回 HTTP 200，5173 与 8000 均在监听，未重启或替换现有服务。
- 未进行真实浏览器交互、F5 按键或窄屏截图目视验收；自动测试验证存储的重新读取，不应等同完整浏览器端到端验收。

## 运行
现有前后端服务继续运行。视觉页面：
http://127.0.0.1:5173/#/workshops/visual

重新启动前端：
```powershell
cd D:\InspireStudio\frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```
后端（视觉演示不依赖后端）：
```powershell
cd D:\InspireStudio\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
检查：在 frontend 目录运行 npm.cmd run build、npm.cmd run lint、node --test tests/visual.test.ts；在 backend 目录运行 .\.venv\Scripts\python.exe -m pytest -q。

所有新增源码、测试、备份、构建产物和报告均位于 D 盘项目内；未安装额外依赖。
