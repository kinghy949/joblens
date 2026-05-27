# JobLens

一个面向求职者的 AI 简历优化工作台 —— 多 Agent 协作，把"一份简历 + 一个 JD"快速拆解为可执行的优化建议。

> 🚧 V1 开发中，目标 2026-07 初上线 demo。

## 是什么

粘贴一段 JD，上传一份简历，30 秒内得到：
- 📊 **匹配度雷达图** —— 技术 / 经验 / 项目相关性 / 沟通信号 / 亮点稀缺度
- ✍️ **逐句改写 diff** —— 每条 bullet 原文 vs 优化版的红绿对照
- 🎯 **关键词覆盖热力** —— JD 关键词在简历里的命中情况
- 🎤 **模拟面试官提问** —— 基于你的简历最可能被追问的 3-5 个问题，附考察点

## 设计

四个 Agent 并行流式输出：

| Agent | 职责 |
|---|---|
| `JDParserAgent` | 解析 JD 的硬技能 / 软技能 / 隐藏要求 |
| `ResumeAnalystAgent` | 提取简历亮点与弱项 |
| `MatchScorerAgent` | 按 5 个维度打分 |
| `RewriterAgent` | 逐 bullet 生成改写建议 |
| `InterviewerAgent` | 生成针对性追问 |

## 技术栈

- Next.js 15 · TypeScript · Tailwind · shadcn/ui
- Vercel AI SDK (streaming)
- Anthropic Claude (Sonnet 4.6 主 / Haiku 4.5 轻任务)
- Supabase (Auth + Postgres + Storage)
- Recharts · react-diff-viewer

## 状态

| 里程碑 | 状态 |
|---|---|
| Week 1 — 单 Agent 跑通主流程 | ⏳ |
| Week 2 — 多 Agent 编排骨架 | — |
| Week 3 — 可视化 + diff | — |
| Week 4 — 模拟面试官 + 打磨 | — |
| Week 5-6 — Buffer / 上线物料 | — |

## License

MIT
