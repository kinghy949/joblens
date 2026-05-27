# JobLens · 部署设计（Docker Compose / 自托管）

> 目标：在一台 2C4G 的 VPS 上，`docker compose up -d` 一行命令拉起整个生产环境。
> 本文档是部署架构的设计稿，不是部署脚本本身。

---

## 一、服务拓扑

```
        Internet
           │
           ▼ :80/:443
    ┌──────────────┐
    │    caddy     │  反向代理 + 自动 TLS
    └──────┬───────┘
           │ 内网 :3000
           ▼
    ┌──────────────┐
    │     next     │  Next.js standalone (Node)
    └──┬─────────┬─┘
       │         │
       ▼ :5432   ▼ :6379
    ┌──────┐  ┌──────┐
    │ pg16 │  │redis7│
    └──┬───┘  └──────┘
       │
       ▼ pg_dump nightly
    ┌──────┐
    │backup│  pg_dump 定时备份卷
    └──────┘
       │
       │ 每小时
       ▼
    ┌──────┐
    │ cron │  清理过期 shared_results
    └──────┘
```

所有服务跑在同一个 Docker network (`joblens_net`)，对外只暴露 caddy 的 80/443。

---

## 二、`docker-compose.yml` 草稿

```yaml
name: joblens

services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"   # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - next
    networks:
      - joblens_net

  next:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://joblens:${POSTGRES_PASSWORD}@postgres:5432/joblens
      REDIS_URL: redis://redis:6379
      PROVIDER: llama
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - joblens_net

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: joblens
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: joblens
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U joblens"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - joblens_net

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --save "" --appendonly no   # 内存模式即可
    networks:
      - joblens_net

  cron:
    image: postgres:16-alpine
    restart: unless-stopped
    entrypoint:
      - /bin/sh
      - -c
      - |
        while true; do
          PGPASSWORD=$$POSTGRES_PASSWORD psql -h postgres -U joblens -d joblens \
            -c "delete from shared_results where expires_at < now();"
          sleep 3600
        done
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - joblens_net

  backup:
    image: postgres:16-alpine
    restart: unless-stopped
    entrypoint:
      - /bin/sh
      - -c
      - |
        while true; do
          ts=$$(date +%Y%m%d-%H%M%S)
          PGPASSWORD=$$POSTGRES_PASSWORD pg_dump -h postgres -U joblens joblens \
            | gzip > /backups/joblens-$$ts.sql.gz
          find /backups -name "joblens-*.sql.gz" -mtime +7 -delete
          sleep 86400
        done
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - ./backups:/backups
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - joblens_net

volumes:
  pg_data:
  caddy_data:
  caddy_config:

networks:
  joblens_net:
```

---

## 三、`Caddyfile`

```caddy
{
    email admin@joblens.xxx
}

joblens.xxx {
    encode zstd gzip
    reverse_proxy next:3000 {
        flush_interval -1   # SSE 立即刷新，不要缓冲
    }
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
    }
}
```

`flush_interval -1` 是关键——保证 Agent 流式 token 实时推到客户端，不被代理缓冲。

---

## 四、`Dockerfile`（Next.js standalone）

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# next.config.js 需配置 output: 'standalone'
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

最终镜像约 150-180 MB。

---

## 五、`.env` 模板（仓库提交 `.env.example`，真实 `.env` 不入仓）

```bash
# Required
POSTGRES_PASSWORD=change-me-to-something-long

# Provider keys
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx  # 可选，Claude 模式才需要

# App config
PROVIDER=llama        # llama | claude
PUBLIC_BASE_URL=https://joblens.xxx

# Rate limit
RATE_LIMIT_PER_HOUR=10
```

---

## 六、`db/init.sql`

```sql
create table if not exists shared_results (
  id          text primary key,
  context     jsonb not null,
  created_at  timestamptz default now(),
  expires_at  timestamptz default now() + interval '24 hours',
  view_count  int default 0
);

create index if not exists shared_results_expires_at_idx
  on shared_results (expires_at);
```

容器首次启动时由 postgres 镜像自动执行。

---

## 七、首次部署 Runbook

在一台干净 Ubuntu 22.04 / Debian 12 上：

```bash
# 1. 安装 docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# 2. 拉代码
git clone https://github.com/kinghy949/joblens.git
cd joblens

# 3. 配置环境变量
cp .env.example .env
$EDITOR .env    # 填密钥

# 4. 配置域名
$EDITOR Caddyfile   # 把 joblens.xxx 改成真实域名

# 5. DNS 指向服务器 IP（在域名注册商面板设 A 记录）

# 6. 启动
docker compose up -d --build

# 7. 看日志验证
docker compose logs -f next caddy
```

首次启动 caddy 会自动申请 Let's Encrypt 证书，等 30 秒后访问 `https://joblens.xxx` 应该看到落地页。

---

## 八、更新部署（CD）

最简单方案——服务器上手动 pull：

```bash
cd ~/joblens
git pull
docker compose up -d --build next
```

进阶方案（V1 后再考虑）：
- **GitHub Actions** 在 main 分支 push 后通过 SSH 触发服务器更新
- **Watchtower** 容器自动拉取新镜像（需先把 next 镜像推到 GHCR）

---

## 九、备份与恢复

**自动备份：** `backup` 服务每日 `pg_dump | gzip` 到 `./backups/`，保留最近 7 天。

**手动备份：**
```bash
docker compose exec postgres pg_dump -U joblens joblens | gzip > backup-$(date +%F).sql.gz
```

**恢复：**
```bash
gunzip -c backup-2026-06-01.sql.gz | docker compose exec -T postgres psql -U joblens joblens
```

**异地备份（V1 可选）：** 用 `rclone` 把 `./backups/` 每日同步到 S3 / R2 / 阿里云 OSS。

---

## 十、监控与告警（V1 极简版）

| 关心什么 | 怎么看 |
|---|---|
| 容器是否在跑 | `docker compose ps` |
| 资源占用 | `docker stats` |
| 应用日志 | `docker compose logs -f next` |
| Caddy 访问日志 | `docker compose logs caddy` |
| 数据库连接数 | `docker compose exec postgres psql -U joblens -c "select count(*) from pg_stat_activity;"` |
| 磁盘 | `df -h` |

VPS 厂商自带的 CPU/网络告警足够覆盖 V1。

V2 可以加 `dozzle` 容器做日志可视化、`uptime-kuma` 做外部探活。

---

## 十一、安全 checklist

部署前必须确认：

- [ ] VPS SSH 关闭密码登录，只允许 key
- [ ] 防火墙只开 22/80/443（`ufw allow 22,80,443`）
- [ ] `.env` 文件权限 `chmod 600`
- [ ] `POSTGRES_PASSWORD` 用 `openssl rand -hex 32` 生成
- [ ] Docker socket 不挂载到任何容器
- [ ] Caddy 自动续证书已生效（首次部署后 `docker compose logs caddy | grep certificate`）
- [ ] 定时检查 `apt upgrade` 和 `docker compose pull`
- [ ] `.env`、`backups/` 不进 git（加 `.gitignore`）

---

## 十二、面试 talking points（部署层）

- **"为什么不用 Vercel？"** → 数据主权 + 零厂商绑定 + 成本可预测；Next.js standalone 让我们完全无依赖
- **"流式 SSE 怎么不被 Caddy 缓冲？"** → `flush_interval -1`，让代理在第一个字节就刷出去
- **"怎么保证数据真的 24h 删除？"** → 独立的 `cron` 容器每小时跑 SQL `delete`，不依赖应用代码逻辑——应用代码可能被改、cron 容器是独立保障
- **"单机怎么扛流量？"** → V1 demo 期不需要扛，2C4G 足够 1000 次/月；要扩可以把 next 服务 `--scale=3` + Caddy 负载均衡，Postgres/Redis 不变
- **"密钥怎么管？"** → `.env` 文件 + 600 权限 + 不入仓；V2 上 Vault / SOPS
