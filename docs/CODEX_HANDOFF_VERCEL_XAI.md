# Codex 交接说明：项目架构、Vercel 部署与 xAI 配置

把本文整段（或按需截取）交给 Codex，请它**审核并整理仓库**，目标：**从 GitHub 推送到 Vercel 后能一键部署并正常运行**（前端 + `/api/underwrite` + xAI 承保）。

---

## 1. 项目是什么

- **BCIT BCP / MerchantWerx onboarding 演示**：商户入驻问卷、上传文件、**AI 核保**（结构化 JSON）、管理端查看。
- **技术栈**：React 19 + TypeScript + **Vite 6**（`npm run build` → 输出 **`dist/`**）+ Tailwind 4 + Vercel AI SDK（`ai` + `@ai-sdk/xai`）+ `zod` + `unpdf`（PDF 文本兜底）。

---

## 2. 运行时架构（三张“脸”）

### A. 本地开发 `npm run dev`

- **Vite** 起静态 + HMR（默认端口 **3000**）。
- **`vite.config.ts`** 里注册了 **Connect 中间件**：拦截 **`POST /api/underwrite`**，读 body，调用 **`server/runUnderwriting.ts`** 的 `runUnderwriting`，返回 JSON。
- **环境变量**：`loadEnv` 读 `.env` / `.env.local`，并把 `XAI_API_KEY`、`XAI_MODEL`、`AI_MODEL` 以及所有 **`*_XAI_API_KEY`** 写入 **`process.env`**，供 `resolveXaiApiKey()` 使用。
- **注意**：浏览器**绝不**应持有 xAI Key；仅服务端 / 中间件使用。

### B. Vercel 生产环境

- **静态资源**：Vite build 的 **`dist/`**（`vercel.json` 里配置了 `buildCommand`、`outputDirectory`）。
- **SPA 路由**：`vercel.json` 的 `rewrites` 把非 `api/` 的路径指到 **`/index.html`**，避免 React Router 类前端路由 404。
- **Serverless API**：根目录 **`api/underwrite.ts`** → 对外路径 **`POST /api/underwrite`**（Vercel 约定）。
- Handler 已改为 **Web `Request -> Response`** 形态，内部同样调用 **`runUnderwriting`**；`vercel.json` 里为该函数显式配置了 **`maxDuration`**。

### C. 前端如何触发 AI

- **`src/components/ChatApp.tsx`**（流程结束）：`fetch('/api/underwrite', { method: 'POST', body: JSON.stringify({ merchantData }) })`。
- 相对路径保证：生产与本地同源调用 `/api/underwrite`。
- 若 payload 估算接近 **Vercel 4.5 MB body limit**，前端会自动退化为 **只发送文件元数据**，确保承保 API 不因 `413 FUNCTION_PAYLOAD_TOO_LARGE` 直接失败。

---

## 3. xAI 在代码里的位置（给 Codex 改代码时对照）

| 用途 | 文件 | 说明 |
|------|------|------|
| 实际调用模型 | `server/runUnderwriting.ts` | `createXai({ apiKey })` + `generateObject`；默认模型 **`grok-4-fast-non-reasoning`**（可被 `XAI_MODEL` / `AI_MODEL` 覆盖）。 |
| 解析 API Key | `server/runUnderwriting.ts` → `resolveXaiApiKey()` | 优先 **`XAI_API_KEY`**，否则取任意环境变量名以 **`_XAI_API_KEY`** 结尾且非空（按名排序），兼容 Vercel xAI 集成注入的 **`AIxxxxxx_XAI_API_KEY`**。 |
| PDF / 图片策略 | 同文件 | 默认：**PDF 先做本地文本抽取**，图片保留多模态输入；如果图片多模态失败，再退回纯文本。Prompt 里会额外写入上传文件清单，便于 metadata-only 降级时保留上下文。 |
| HTTP 入口（生产） | `api/underwrite.ts` | Web `Request/Response` handler；校验 body、检查 `resolveXaiApiKey()`、调 `runUnderwriting`、JSON 响应。 |
| HTTP 入口（本地） | `vite.config.ts` 中间件 | 同上逻辑。 |
| 接口格式文档 | `docs/xai-api.md`、`server/xaiApiReference.ts` | xAI Chat Completions / Files+Responses 对照说明。 |
| 本地流式自检 | `scripts/xai-stream-smoke.ts`、`npm run smoke:xai` | 需 `.env.local`（如 `vercel env pull`）。 |

---

## 4. 环境变量清单（Vercel Dashboard 必配）

**承保必需（至少其一）：**

- **`XAI_API_KEY`** = `xai-...`，或  
- 任意 **`…_XAI_API_KEY`**（Vercel xAI 集成常见，如 `AI123456789_XAI_API_KEY`）。

**可选：**

- **`XAI_MODEL`** / **`AI_MODEL`**：覆盖默认 `grok-4-fast-non-reasoning`。
- **`NODE_ENV`**：由平台设置；生产下 API 错误响应一般不返回 stack（见 `api/underwrite.ts`）。

**禁止：**

- 不要把 Key 做成 **`VITE_*`**，否则会进前端 bundle。

**同步到本地：**

```bash
vercel link
vercel env pull   # → .env.local（已在 .gitignore）
```

---

## 5. Vercel / GitHub 流程（给 Codex 核对）

1. 仓库连接 GitHub，Push 触发 **Production**（及可选 Preview）部署。
2. 在 Vercel **Project → Settings → Environment Variables** 为 **Production**（和需要的 **Preview**）配置上述变量。
3. **Redeploy** 一次，确保新变量生效。
4. 构建命令应为 **`npm run build`**，输出 **`dist`**（与 `vercel.json` 一致）。

---

## 6. 建议 Codex 重点排查的“上线即运行”问题

1. **Vercel 对 `api/underwrite.ts` 的打包**  
   - 确认 Node 运行时能否正确编译/打包 **`api/`** + **`server/runUnderwriting.ts`** + **`unpdf`**（无意外部二进制依赖问题）。  
   - 若构建失败，考虑显式 **`@vercel/node`**、或把 handler 改成 Vercel 推荐的 **Request/Response** 形态（需改 `api/underwrite.ts` 与调用链）。

2. **Serverless 限制**  
   - **请求体大小**：Vercel Functions 当前 **4.5 MB** body limit；仓库现已在前端自动回退 metadata-only 以避免直接失败，但若要保留大文件全文仍建议改为直传 Storage + URL。  
   - **执行时间**：`vercel.json` 已为 `api/underwrite.ts` 显式配置 **`maxDuration`**；大 PDF + reasoning 模型仍应优先控制 payload。

3. **`vercel.json` 与 Framework Preset**  
   - 避免 Dashboard 的 Output Directory / Build Command 与 `vercel.json` **冲突**；以能成功产出 `dist` 且 API 可访问为准。

4. **重复依赖**  
   - `package.json` 里 **`vite`** 同时出现在 `dependencies` 与 `devDependencies`，可整理为仅 dev（若 CI 仅需 build）。

5. **类型检查**  
   - `npm run lint`（`tsc --noEmit`）是否应包含 `api/`、`server/`；`tsconfig.json` 若未覆盖，可补 `include`。

6. **官方 PDF 路径（可选增强）**  
   - xAI 文档推荐 **Files API + `/v1/responses` + `input_file`**；当前实现主要是 **Chat Completions 多模态 file**。若原生 PDF 不稳定，可实现官方路径或默认回退文本模式。

---

## 7. 请 Codex 交付物（可直接写进任务描述）

- [ ] 通读 `README.md`、`docs/xai-api.md`、本文件，确认与实现一致；不一致则改文档或改代码。  
- [ ] 确认 **Vercel 生产构建** 能通过，且 **`POST /api/underwrite`** 返回 200（在已配置 Key 的前提下）。  
- [ ] 列出必须在 Vercel 配置的 **环境变量**（可复制到 README「部署检查清单」）。  
- [ ] 处理已知的 **体积/超时** 风险（至少在 README 中说明）。  
- [ ] 保持：**密钥仅服务端**；前端仅 `fetch('/api/underwrite')`。

---

## 8. 一句话摘要（给 Codex 当标题）

> **Vite SPA（`dist`）+ Vercel Serverless `api/underwrite.ts` → `server/runUnderwriting.ts`（xAI `generateObject` + 可选 PDF 多模态/unpdf）；xAI Key 来自 `XAI_API_KEY` 或 `*_XAI_API_KEY`；本地用 Vite 中间件模拟同一路径。请整理依赖与 Vercel 配置，保证 GitHub 推送后部署可运行。**

---

*生成于仓库维护用途；与具体课程/演示数据无关。*
