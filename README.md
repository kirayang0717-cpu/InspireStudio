# InspireStudio · 第一阶段

React + TypeScript + Vite 前端，Python + FastAPI 后端，SQLAlchemy + SQLite。
原始技术文档位于 docs/architecture.md，保持原样。

## 启动

在两个 PowerShell 窗口分别运行：

后端：
```powershell
cd D:\InspireStudio\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

前端：
```powershell
cd D:\InspireStudio\frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

打开 http://127.0.0.1:5173 查看连接状态。
健康检查：http://127.0.0.1:8000/api/health
接口文档：http://127.0.0.1:8000/docs
关闭各终端中的服务可按 Ctrl+C。

## 安装与测试

前端：在 frontend 内执行 npm.cmd ci、npm.cmd run build、npm.cmd run lint。
后端：在 backend 内执行 python -m venv .venv，再用
.\.venv\Scripts\python.exe -m pip install -r requirements.txt。
测试：在 backend 内执行 .\.venv\Scripts\python.exe -m pytest -q。
requirements-lock.txt 记录本次安装版本，可用于复现。

虚拟环境与依赖位于 D 盘项目中。数据库启动时自动创建于
data/database/inspirestudio.db。数据目录不提交 Git。
健康接口验证数据库可查询；失败返回 503，不向客户端暴露异常细节。
CORS 仅允许 localhost:5173 和 127.0.0.1:5173。

## 当前范围

完成工程初始化、数据库连通和前后端通信；未接入 AI API。
业务接口继续预留 /api/v1 前缀；/api/health 为本阶段指定的健康检查。
业务数据表、迁移、用户认证、四大工坊及富文本编辑器留待后续设计与开发。
Tailwind CSS、Tiptap、Zustand 在对应页面开发阶段按架构接入。
Vite 初始示例文件保留，入口使用 ConnectionStatus 页面。

