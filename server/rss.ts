// 直连 RSS / Atom 抓取（无需 API Key，作为 Agent 模式的可靠回退）
import { XMLParser } from 'fast-xml-parser';
import { Category, RawNewsItem, Source } from './types.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

const USER_AGENT =
  'Mozilla/5.0 (compatible; AINewsAgent/1.0; +https://github.com/)';

// 简单的关键词分类启发式
const KEYWORD_RULES: { cat: Category; words: string[] }[] = [
  { cat: 'model_release', words: ['模型', 'model', 'gpt', 'claude', 'llama', 'gemini', '发布', 'release', 'launch', '开源', 'open-source', 'open source'] },
  { cat: 'academic', words: ['论文', 'paper', 'arxiv', '研究', 'research', '学术', '预印本', 'preprint', 'benchmark'] },
  { cat: 'tool_update', words: ['工具', 'tool', '框架', 'framework', '更新', 'update', '库', 'library', 'sdk', 'api', '插件', 'plugin', 'release notes'] },
  { cat: 'policy', words: ['政策', 'policy', '监管', 'regulation', '法案', '法律', 'law', '合规', 'compliance', '反垄断', 'antitrust'] },
  { cat: 'industry', words: ['融资', 'funding', '收购', 'acquire', '并购', '合作', 'partnership', '投资', 'invest', 'ipo', '上市', '营收', 'revenue'] },
];

function guessCategory(text: string): Category {
  const lower = text.toLowerCase();
  let best: Category = 'other';
  let bestScore = 0;
  for (const rule of KEYWORD_RULES) {
    let score = 0;
    for (const w of rule.words) if (lower.includes(w.toLowerCase())) score++;
    if (score > bestScore) { bestScore = score; best = rule.cat; }
  }
  return best;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && '#text' in (v as any)) return String((v as any)['#text'] || '');
  return String(v);
}

function extractLink(entry: any): string {
  // RSS: item.link (string)
  if (typeof entry.link === 'string') return entry.link;
  if (Array.isArray(entry.link)) {
    const l = entry.link.find((x: any) => typeof x === 'string');
    if (l) return l;
  }
  // Atom: link with @_href
  if (entry.link && typeof entry.link === 'object') {
    const links = Array.isArray(entry.link) ? entry.link : [entry.link];
    const alt = links.find((l: any) => l['@_rel'] === 'alternate') || links[0];
    if (alt && alt['@_href']) return alt['@_href'];
  }
  return '';
}

function parseFeed(xml: string, source: Source): RawNewsItem[] {
  const obj = parser.parse(xml);
  let items: any[] = [];
  if (obj.rss?.channel?.item) items = obj.rss.channel.item;
  else if (obj.feed?.entry) items = obj.feed.entry;
  else if (obj['rdf:RDF']?.item) items = obj['rdf:RDF'].item;
  if (!Array.isArray(items)) items = items ? [items] : [];

  const out: RawNewsItem[] = [];
  for (const it of items.slice(0, 25)) {
    const title = stripHtml(asText(it.title));
    const link = extractLink(it);
    if (!title || !link) continue;
    const descRaw = asText(it.description) || asText(it.summary) || asText(it['content:encoded']) || '';
    const summary = stripHtml(descRaw).slice(0, 200);
    const pub =
      asText(it.pubDate) || asText(it.published) || asText(it.updated) || asText(it['dc:date']) || '';
    const publishedAt = pub ? new Date(pub).toISOString() : new Date().toISOString();
    const category: Category =
      source.categoryHint || guessCategory(`${title} ${summary}`);
    out.push({
      title,
      url: link,
      summary,
      source: source.name,
      category,
      publishedAt,
      tags: [],
    });
  }
  return out;
}

export async function fetchSource(source: Source): Promise<RawNewsItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(source.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, source);
  } catch (e) {
    console.error(`[RSS] 抓取失败 ${source.name} (${source.url}):`, (e as Error).message);
    return [];
  }
}

export async function fetchAllSources(sources: Source[]): Promise<RawNewsItem[]> {
  const enabled = sources.filter((s) => s.enabled && s.type === 'rss');
  const results = await Promise.all(enabled.map((s) => fetchSource(s)));
  return results.flat();
}
