# InspireStudio Phase 6：视频工坊第一版

日期：2026-11-16
项目：D:\InspireStudio
状态：代码与自动测试完成；浏览器端人工验收待进行。

## 开发前检查
- 核对 architecture.md、Phase 4/5 报告、App 路由、三个已有工坊的服务与持久化、后端健康接口及数据库初始化。
- Phase 2、3 报告未找到，保留现有 Phase 2 备份，不补造历史报告。
- 架构规定 16:9、9:16、1:1，15/30/60 秒，最终 MP4、分镜与 FFmpeg 合成。当前无视频 API，后端仅健康检查；本版采用浏览器动态图形模板演示，不声称完成真实 AI 或 FFmpeg 合成。
- 项目没有 Git 仓库，无法报告分支。未初始化仓库。
- 修改前源文件、旧文档和后端文件哈希及 App.tsx 备份位于 data/temp/phase6-baseline。最终校验除计划中的 App.tsx 外全部原文件哈希一致。文案、视觉、音频源码及存储未改写。

## 分阶段实施与验证
1. 新增视频模板服务：三比例、三时长、三风格、三段时间轴、生成参数快照、画布绘制、WebM 实时录制。3 项测试通过，build 通过。lint 的一条表达式提示在第二阶段修复。
2. 新增视频页面和独立 IndexedDB 历史。支持生成、重新生成、播放/暂停、进度拖动、回到开头、重新编辑、录制/取消、视频播放与下载、作品保存/恢复/删除。接入时发现原占位分支在四工坊穷尽后被推断为 never，移除不可达占位分支后构建通过。修复新页面 effect 依赖提示后 lint 无警告。
3. 最终自动验证：build、lint 通过；前端 16 passed（视频 3、视频存储 1、原音频/视觉 12）；后端 3 passed，保留一条已有 Starlette/httpx 弃用提示。旧受保护文件校验通过。

## 文件
新增：
- frontend/src/videoService.ts：模板输入校验、画布尺寸、时间轴、动态绘制、WebM 录制。
- frontend/src/videoStorage.ts：独立 inspirestudio.video.v1 IndexedDB 与 works 仓库。
- frontend/src/VideoWorkshop.tsx：视频创作、预览、录制、作品与历史交互。
- frontend/src/VideoWorkshop.css：米白深绿与响应式布局。
- frontend/tests/video.test.ts：输入、规格组合、尺寸、时间边界与独立快照测试。
- frontend/tests/videoStorage.test.ts：跨连接恢复、版本、Blob 字节与删除测试。
- docs/phase6-report.md。
修改：frontend/src/App.tsx（增加导入、接入视频路由、移除已不可达的旧占位内容）。dist 为正常构建产物。本次无依赖安装和后端修改。

## 功能与限制
- 明确标记本地模板演示与非 AI 生成，画布和录制文件也带标识。主题与描述作为文字排版，不理解描述，不生成对应实景。仅三个动态图形分段，无配音、素材导入、字幕编辑、多轨或 AI 分镜。
- 主题最多 120 字符、描述最多 2000 字符。画面显示主题前 16 字符、描述前 54 字符；完整设置随作品保存。风格改变配色，重新生成随机化动态图形起点。
- 分辨率：960×540、540×960、720×720。预览按所选 15/30/60 秒运行，可暂停与拖动。
- 保存的是生成时的快照；修改表单不会替换当前预览，页面会提示。重新生成/恢复未保存作品有确认。编辑设置后需要重新生成才更新作品。
- 浏览器支持 captureStream/MediaRecorder/WebM 时可录制真实无声 WebM，需等待所选完整时长，保持标签页前台；后台节流与系统负载可能造成掉帧、实际时长偏差。不支持时显示错误，仍可使用动画预览与设置保存。本版不提供 MP4；没有伪造扩展名。
- 未录制时保存动画参数即可重建预览；录制后保存包含 WebM Blob。录制结束不自动保存，需点击保存版本；离开时会取消录制并释放媒体轨道。预览下载地址在切换/卸载后释放。
- 独立 IndexedDB，每次保存独立版本，不修改原工坊 key。仅当前浏览器与来源地址，不云同步；清除浏览器数据会丢失。存储空间不足时保存报错，建议下载备份。历史没有自动清理上限，较多视频会消耗浏览器空间。
- 项目代码、报告、备份、构建产物均在 D 盘；浏览器存储位置由浏览器管理。

## 自动测试复核
阶段一：
```powershell
cd D:\InspireStudio\frontend
npm.cmd run build
npm.cmd run lint
node --test tests/video.test.ts
```
阶段二及最终回归：
```powershell
cd D:\InspireStudio\frontend
npm.cmd run build
npm.cmd run lint
node --test tests/video.test.ts tests/videoStorage.test.ts tests/audio.test.ts tests/audioStorage.test.ts tests/visual.test.ts
cd D:\InspireStudio\backend
.\.venv\Scripts\python.exe -m pytest -q
```
存储测试使用既有 fake-indexeddb；测试 Blob 为测试字节，不代表已验证实际录制编码。本次未进行浏览器真实录制、下载、F5、窄屏目视检查或端到端验收，不能把自动检查视为这些项目通过。

## 启动与手动验收
页面：http://127.0.0.1:5173/#/workshops/video

启动前端（已有服务时无需重复启动）：
```powershell
cd D:\InspireStudio\frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```
本地视频不依赖后端，系统连接页需要后端：
```powershell
cd D:\InspireStudio\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

手动验收：
1. 输入主题与描述，依次测试三比例及 15/30/60 秒。生成后应看到演示标识、对应画布和时长；播放到终点停止，暂停/拖动/重播应正常。
2. 改表单设置，预览保持旧结果并显示设置变化；重新生成后更新。保存、F5、恢复，设置与模板预览应一致。
3. 选择 15 秒，录制 WebM，保持前台等待完成。在视频播放器播放、下载并用本地播放器核对演示水印、比例、运动与时长。保存后 F5 恢复，应可再次播放和下载文件。
4. 取消录制不应报告成功；不支持录制时应明确提示，不能出现假视频。
5. 保存不同版本，恢复早期版本，删除测试版本后 F5，列表应一致。缩窄窗口后面板单列、按钮可用。
6. 访问首页、导航、系统连接及已验收三个工坊，确认原页面与历史仍在，无需改写其数据。

浏览器录制能力依据：
https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream
https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static
