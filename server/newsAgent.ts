// 基于 CodeBuddy Agent SDK 的智能资讯抓取 Agent
// Agent 使用其内置的网络浏览工具访问配置的信息源，并返回结构化 JSON。
// 若未配置 CODEBUDDY_API_KEY 或抓取失败，调度器会自动回退到直连 RSS 模式。
import { query } from '@tencent-ai/agent-sdk';
import { Category, RawNewsItem, Source, VALID_CATEGORIES } from './types.js';

const CATEGORY_ENUM = VALID_CATEGORIES.join(' / ');

const DEFAULT_SYSTEM_PROMPT = `你是一个专业的「AI 领域资讯抓取 Agent」。
你的任务：使用你可用的网络浏览工具（WebFetch / WebSearch 等）访问用户提供的信息源，
收集最新（优先最近 24-48 小时）的 AI 相关新闻、论文、产品发布与行业动态。

严格要求：
1. 你必须真正使用网络工具去获取真实内容，绝不可编造链接或内容。
2. 每条资讯必须包含真实可访问的原文链接（url）。
3. 分类（category）只能从以下枚举中选择：${CATEGORY_ENUM}
   - model_release: 新大模型/能力发布
   - industry: 公司融资、合作、并购、产品落地等
   - academic: 学术论文、新研究
   - tool_update: 工具/框架/SDK/库 更新
   - policy: 政策、监管、法律
   - other: 其他
4. summary 用中文概括，一句话（不超过 40 字）。
5. 只输出 JSON 数组，不要任何解释性文字，不要使用 markdown 代码块包裹。`;

export interface AgentRunOptions {
  sources: Source[];
  model: string;
  systemPrompt?: string;
  maxTurns?: number;
}

function buildPrompt(sources: Source[]): string {
  const list = sources
    .filter((s) => s.enabled)
    .map((s) => `- ${s.name}（${s.type}）: ${s.url}`)
    .join('\n');
  return `请抓取以下 AI 信息源的最新内容：\n${list}\n\n返回格式示例：
[
  {
    "title": "标题",
    "url": "https://...",
    "summary": "一句话中文摘要",
    "source": "信息源名称",
    "category": "model_release",
    "publishedAt": "2026-07-07T10:00:00Z",
    "tags": ["关键词1", "关键词2"]
  }
]
信息源较多，请尽量覆盖不同来源的亮点内容，最多返回 50 条，按时间倒序。`;
}

function parseNewsJson(text: string): RawNewsItem[] {
  // 去掉可能的代码块包裹
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  }
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(t.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.title === 'string' && typeof x.url === 'string')
      .map((x) => ({
        title: String(x.title),
        url: String(x.url),
        summary: typeof x.summary === 'string' ? x.summary : '',
        source: typeof x.source === 'string' ? x.source : '',
        category: (VALID_CATEGORIES as string[]).includes(String(x.category))
          ? (x.category as Category)
          : 'other',
        publishedAt:
          typeof x.publishedAt === 'string' && !isNaN(Date.parse(x.publishedAt))
            ? new Date(x.publishedAt).toISOString()
            : new Date().toISOString(),
        tags: Array.isArray(x.tags) ? x.tags.map(String).slice(0, 8) : [],
      }));
  } catch {
    return [];
  }
}

export async function runNewsAgent(opts: AgentRunOptions): Promise<RawNewsItem[]> {
  const sources = opts.sources.filter((s) => s.enabled);
  if (sources.length === 0) return [];

  const stream = query({
    prompt: buildPrompt(sources),
    options: {
      cwd: process.cwd(),
      model: opts.model,
      maxTurns: opts.maxTurns ?? 20,
      systemPrompt: opts.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
      permissionMode: 'bypassPermissions',
    },
  });

  let full = '';
  for await (const msg of stream) {
    const m = msg as any;
    if (m.type === 'assistant') {
      const content = m.message?.content;
      if (typeof content === 'string') full += content;
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'text' && block.text) full += block.text;
        }
      }
    }
  }

  const items = parseNewsJson(full);
  console.log(`[Agent] 抓取到 ${items.length} 条资讯`);
  return items;
}
