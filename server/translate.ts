// 基于 CodeBuddy Agent SDK 的中文翻译服务
// 重点：禁用一切网络/文件工具，确保翻译是纯文本处理，不会误触发抓取或浏览器访问。
import { query } from '@tencent-ai/agent-sdk';

const TRANSLATE_SYSTEM = `你是一个专业的 AI 新闻翻译引擎。请将用户提供的英文（或中英混杂）新闻标题与摘要翻译为流畅、准确的简体中文。

严格要求：
1. 只做翻译，不要添加任何解释、评论，也不要用 markdown 代码块包裹。
2. 保留专有名词的英文原文（公司名、产品名、模型名、技术术语、API 名称等），可在首次出现时以括号附中文译名。
3. 必须只输出一个 JSON 对象，格式严格为：
{"title":"中文标题","summary":"中文摘要"}
4. summary 保持简洁，长度不超过原文，且为中文。
5. 若原文已是中文，则直接返回（或做轻度润色），不要改写为英文。`;

export interface Translated {
  title: string;
  summary: string;
}

function buildPrompt(title: string, summary: string): string {
  return `请翻译以下内容：\n标题：${title}\n摘要：${summary && summary.trim() ? summary : '（无摘要）'}`;
}

function parseTranslation(text: string): Translated | null {
  let t = (text || '').trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const obj = JSON.parse(t.slice(start, end + 1));
      if (obj && typeof obj.title === 'string') {
        return { title: obj.title, summary: typeof obj.summary === 'string' ? obj.summary : '' };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function translateItemText(
  title: string,
  summary: string,
  model: string
): Promise<Translated> {
  const stream = query({
    prompt: buildPrompt(title, summary),
    options: {
      cwd: process.cwd(),
      model,
      maxTurns: 1,
      systemPrompt: TRANSLATE_SYSTEM,
      permissionMode: 'bypassPermissions',
      disallowedTools: [
        'WebFetch',
        'WebSearch',
        'Bash',
        'Write',
        'Edit',
        'NotebookEdit',
        'TodoWrite',
        'Read',
        'Glob',
        'Grep',
        'mcp__*',
      ],
    },
  });

  let full = '';
  for await (const msg of stream) {
    const m = msg as any;
    if (m.type === 'assistant') {
      const content = m.message?.content;
      if (typeof content === 'string') full += content;
      else if (Array.isArray(content)) {
        for (const b of content) if (b?.type === 'text' && b.text) full += b.text;
      }
    }
  }

  const parsed = parseTranslation(full);
  if (!parsed || !parsed.title) {
    throw new Error('翻译结果解析失败，请重试');
  }
  return parsed;
}
