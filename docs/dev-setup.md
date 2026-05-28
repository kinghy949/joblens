# JobLens · 本地开发环境

3 步上手，可以在 5 分钟内把 demo 跑起来。

## 0. 前置

- Node.js 20+（推荐通过 `nvm` 装）
- pnpm（首次 `corepack enable && corepack prepare pnpm@latest --activate`）
- Docker Desktop（可选，仅用于跑 postgres / redis 后端服务）

## 1. 装依赖

```bash
git clone https://github.com/kinghy949/joblens.git
cd joblens
pnpm install
```

首次 install 会被 pnpm 提示 `Ignored build scripts: ...`，已在 `pnpm-workspace.yaml` 中明确允许 esbuild / sharp / unrs-resolver、拒绝 canvas，不需要手动 approve。

## 2. 配置 API key

复制 `.env.example` 为 `.env` 并填入：

```bash
cp .env.example .env
chmod 600 .env
```

最少需要：

```
NVIDIA_API_KEY=nvapi-xxx      # 注册 https://build.nvidia.com 后获取
PROVIDER=llama                 # llama (默认) / claude
ANTHROPIC_API_KEY=             # 可选，PROVIDER=claude 时必填
LOG_LEVEL=debug
```

## 3. 启动

**最简（无后端服务，只跑 Next.js）：**

```bash
pnpm dev
```

打开 `http://localhost:3000` 即可。
落地页"立即试用"按钮带 `?demo=1`，全流程不调真实 LLM——直接看到 UI 体验。

**完整（含 postgres + redis，为 Week 2+ 分享链接功能准备）：**

```bash
# 终端 1：起后端服务
docker compose -f docker-compose.dev.yml up -d

# 验证就绪
docker compose -f docker-compose.dev.yml ps        # 两个 service 应该 healthy

# 终端 2：起 Next.js
pnpm dev
```

为什么不把 Next.js 也放进 docker？因为 dev 模式 + 源码挂载 + HMR 的体验明显比直接在 host 上跑差（macOS 上 FS 性能尤甚）。生产部署的完整 compose 见 `docs/deployment.md`。

## 4. 跑测试 / 端到端验证

```bash
pnpm typecheck                              # tsc --noEmit
pnpm test                                    # 24 vitest cases
pnpm tsx scripts/smoke-provider.ts          # 验证 NIM 可达
pnpm tsx scripts/test-jd-parser.ts 10       # JDParser 10× 验收
pnpm tsx scripts/test-resume-analyst.ts 10  # ResumeAnalyst 10× 验收
pnpm tsx scripts/test-analyze-route.ts      # 端到端 /api/analyze (需 dev 在跑)
pnpm tsx scripts/freeze-golden.ts           # 重新生成 demo 模式的 golden 结果
```

## 5. 常见问题

**Q: `pnpm install` 卡住或提示 `EAGAIN`？**
NIM API 包通过 npmjs 拉取，建议确认网络畅通；国内推荐 `pnpm config set registry https://registry.npmmirror.com` 后重试。

**Q: 看到 `NVIDIA_API_KEY is not set` 错误？**
没读到 `.env`。确认文件存在、`chmod 600`、且 key 以 `nvapi-` 开头。

**Q: demo 模式没数据？**
`fixtures/golden-result.json` 缺失。先跑一次 `pnpm tsx scripts/freeze-golden.ts`（需要 dev server 在跑且配置好 NIM key）。

**Q: 端口冲突 (5432 / 6379 / 3000)？**
改 `docker-compose.dev.yml` 的 ports，或停掉占用进程：
```bash
lsof -i :3000   # 看谁占了
```
