'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const DEMO_JD = `我们正在招聘高级后端工程师 · LLM 应用方向。

岗位职责：
1. 负责公司核心 LLM 应用后端服务的设计与开发，包括对话编排、检索增强（RAG）、工具调用等关键链路
2. 主导高并发场景下的系统稳定性建设，参与设计支撑日均千万级请求的服务架构
3. 与算法团队协作，将研究成果工程化落地
4. 带领 2-3 人小组完成模块级开发任务

任职要求：
- 3 年以上后端开发经验，精通 Python（FastAPI / Django）
- 熟悉分布式系统设计、消息队列 (Kafka/RabbitMQ)、Kubernetes
- 熟悉 Postgres / MySQL
- 有 LLM 应用（RAG / Agent / Function Calling）相关的工程化经验`

const DEMO_RESUME_NAME = '示例简历 · 张某 · 后端工程师 3 年.md'

const DEMO_RESUME_TEXT = `# 张某 · 后端工程师（示例简历）

## 个人信息
- 姓名：张某
- 工作年限：3 年
- 邮箱：zhang.demo@example.com
- 城市：上海

## 教育背景
- 某 211 大学 · 计算机科学与技术 · 本科 · 2018-2022

## 工作经历

### 某电商公司 · 后端工程师 · 2022.07 – 至今
负责订单交易链路的后端开发与维护。
- 负责后端开发，使用 Python 完成 API
- 参与订单系统的重构，把老的单体服务拆成几个微服务
- 用 Redis 做缓存，提升了接口性能
- 处理一些线上 bug，写过几个内部工具脚本
- 协调测试和前端，推动需求按时上线

### 某创业公司 · 后端实习生 · 2021.06 – 2022.06
- 负责一个内部管理系统的后端，技术栈是 Django + MySQL
- 写了一些数据导出脚本
- 帮助前端调试接口

## 项目经历

### 订单系统重构（公司项目）
- 把老系统的下单链路拆开，分成订单服务、库存服务、支付服务
- 接入了 RabbitMQ 做异步消息
- 部署在 k8s 集群上

### 内部数据看板（个人项目）
- 用 FastAPI + Vue 写的一个内部用的数据展示页
- 数据从 Postgres 取，做了一些聚合

## 技术栈
Python、FastAPI、Django、MySQL、Postgres、Redis、RabbitMQ、Docker、Kubernetes、Git、Linux

## 自我评价
- 责任心强，能够独立完成被分配的任务
- 学习能力较好，对新技术保持兴趣
- 有良好的团队合作精神`

export function AnalyzeForm() {
  const router = useRouter()
  const params = useSearchParams()
  const isDemo = params.get('demo') === '1'

  const [jd, setJd] = useState(isDemo ? DEMO_JD : '')
  const [fileName, setFileName] = useState<string | null>(
    isDemo ? DEMO_RESUME_NAME : null,
  )

  const canSubmit = jd.trim().length >= 50 && fileName

  function useExample() {
    setJd(DEMO_JD)
    setFileName(DEMO_RESUME_NAME)
  }

  function start() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'joblens.analyze.pending',
        JSON.stringify({
          jd_text: jd,
          resume_text: fileName === DEMO_RESUME_NAME ? DEMO_RESUME_TEXT : jd,
          is_demo: isDemo,
          ts: Date.now(),
        }),
      )
    }
    router.push(isDemo ? '/analyze/loading?demo=1' : '/analyze/loading')
  }

  return (
    <>
      <main className="flex-1 pb-32">
        <div className="mx-auto max-w-container px-6 pt-12 md:px-12">
          <h1 className="text-display">开始分析</h1>
          <p className="mt-2 text-body-md text-foreground-variant">
            粘贴一段 JD + 上传你的简历，AI 会在 15 秒内给出多维度报告。
          </p>

          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
            <section>
              <label className="text-label-sm uppercase tracking-wider text-foreground-variant">
                JD · JOB DESCRIPTION
              </label>
              <div className="mt-3 overflow-hidden rounded border border-outline-variant bg-surface-container-lowest">
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  spellCheck={false}
                  className="block h-[480px] w-full resize-none border-0 bg-transparent p-4 font-mono text-body-md leading-6 text-foreground placeholder:text-foreground-variant/60 focus:outline-none focus:ring-0"
                  placeholder="把岗位 JD 粘贴到这里。例如：'我们正在招聘高级后端工程师...'"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-label-md text-foreground-variant">
                  {jd.length} / 8000 字
                </span>
                <button
                  disabled
                  className="rounded border border-outline-variant bg-surface-container-low px-3 py-1.5 text-label-md text-foreground-variant"
                >
                  从 URL 抓取 (V2)
                </button>
              </div>
            </section>

            <section>
              <label className="text-label-sm uppercase tracking-wider text-foreground-variant">
                简历 · RESUME
              </label>
              <label className="mt-3 flex h-[480px] cursor-pointer flex-col items-center justify-center rounded border border-dashed border-outline-variant bg-surface-container-lowest text-center transition hover:border-foreground">
                <input
                  type="file"
                  accept=".pdf,.md,.txt"
                  className="hidden"
                  onChange={(e) =>
                    setFileName(e.target.files?.[0]?.name ?? null)
                  }
                />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-12 w-12 text-foreground"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5V16"
                  />
                </svg>
                <p className="mt-6 text-title-lg text-foreground">
                  {fileName ?? '把简历拖到这里'}
                </p>
                <p className="mt-1 text-body-md text-foreground-variant">
                  或点击选择文件 · 支持 PDF / MD / TXT · 最大 5MB
                </p>
              </label>

              <div className="mt-4 flex items-center justify-between rounded border border-outline-variant bg-surface-container-lowest px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-surface-container">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-5 w-5 text-foreground-variant"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <span className="text-body-md text-foreground">示例简历</span>
                </div>
                <button
                  onClick={useExample}
                  className="rounded border border-outline-variant px-3 py-1.5 text-label-md font-medium text-foreground transition hover:bg-surface-container-low"
                >
                  用示例简历填入
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-container items-center justify-between px-6 py-4 md:px-12">
          <div className="flex items-center gap-3 text-body-md">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 text-label-md text-foreground-variant">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-3.5 w-3.5"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" strokeLinecap="round" />
              </svg>
              Provider: Llama 3.3 (默认)
            </span>
            <button className="text-label-md text-foreground underline-offset-2 hover:underline">
              切换 Claude
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={useExample}
              className="hidden text-body-md text-foreground-variant hover:text-foreground md:inline"
            >
              用示例 JD + 简历一键体验
            </button>
            <button
              onClick={start}
              disabled={!canSubmit}
              className="inline-flex h-12 items-center rounded bg-primary px-8 text-body-md font-medium text-primary-foreground transition hover:opacity-90 disabled:bg-surface-container-high disabled:text-foreground-variant"
            >
              开始分析 →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
