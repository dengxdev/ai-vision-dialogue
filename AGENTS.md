# AI 视觉对话助手 — 项目级提示词（AGENTS.md）

## 项目背景
这是一个参加七牛云 XEngineer 暑期实训营的作品。核心议题是"AI 视觉对话助手"——
用户通过浏览器授权摄像头和麦克风，对着摄像头展示物体/场景并语音提问，
AI 能"看到"画面、理解语音，并用语音回答。

比赛评审维度：
- 作品完整度与创新性（40%）
- 开发过程与质量——架构清晰度、代码质量、PR/commit 规范性（40%）
- 演示与表达（20%）

核心加分项：端云协同的成本控制策略。

## 技术栈
- 前端：React 18 + TypeScript + Vite
- BFF 后端：NestJS + Fastify + Socket.IO
- 前后端通信：WebSocket（Socket.IO）
- 前后端契约：ts-rest + Zod
- 配置管理：Zod 运行时校验 + .env 多环境
- 部署：前端 Vercel + BFF Render

## 架构规范

### 三层解耦
1. 前端应用层：UI 渲染 + 媒体采集 + 端侧预处理 + 状态机调度
2. BFF 适配层：请求路由 + Token 压缩 + 成本控制 + 缓存 + 限流
3. 微服务层：多模态大模型 API（Qwen-VL / Qwen-Turbo）

### 通信规范
- 前端不直接调用视觉/LLM API，所有 API 调用通过 BFF
- 前端与 BFF 通过 WebSocket（Socket.IO）通信
- BFF 与微服务通过 HTTP REST 通信
- 前后端接口契约使用 ts-rest + Zod 定义

### Monorepo 结构
- 使用 pnpm workspaces + Turbo 增量编译
- 公共类型定义在 packages/shared 中，前后端共享
- 前后端契约在 packages/contract 中定义，使用 ts-rest
- 不允许在 apps 中直接引用外部类型，必须通过 packages/shared

### 成本控制策略（必须实现）
1. Canvas 图像压缩（最大 512x512，JPEG quality 0.7）
2. 帧间变化检测（无变化帧不发送 API 请求）
3. BFF 层三级过滤（场景→分辨率→调用频次）
4. 动态分辨率降级（RPM 高时自动降低图片尺寸）
5. 对话上下文滑动窗口 + 摘要
6. 成本监控面板（Ctrl+Shift+D 显示 API 调用次数/Token/费用）

### 代码规范
- TypeScript 严格模式开启
- 所有环境变量必须通过 Zod schema 校验
- API Key 不得硬编码，必须从环境变量读取
- 每个 PR 只做一件事，PR 描述必须按模板填写
- Commit 信息格式：`<type>(<scope>): <description>`

### 错误降级策略
- 摄像头权限被拒 → 降级为文字输入
- 视觉 API 超时 → 纯文字对话
- 网络断开 → 离线提示
- BFF 断开 → 降级本地模式
- 所有 API 调用必须有 try/catch + 友好错误提示

## 关键约束
1. **PR 持续交付**：从第一天开始持续提交，不能最后一天集中提交
2. **每个 PR 只做一件事**：大功能拆分为多个小 PR
3. **Commit 时间戳必须在批次有效期内**
4. **72 小时完成**：功能完整 > 完美设计，先跑通再优化
5. **演示优先**：所有功能必须能在 3-5 分钟视频中展示

## 接口契约
前后端通信使用 ts-rest 定义的契约（见 packages/contract/src/index.ts）。
前端使用 @ts-rest/react-query 调用。
后端使用 @ts-rest/nest 实现控制器。
任何接口变更必须同步修改契约文件。

## 文件变更规范
每次修改代码时：
1. 说明变更的文件和原因
2. 如果新增依赖，说明用途和版本
3. 如果修改接口，同步更新契约文件
4. 输出本轮变更的 PR 标题和描述（按模板）