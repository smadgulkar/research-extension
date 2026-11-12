import { db } from '../storage/db';
import { LLMService } from './llm';
import type { Knowledge } from '../storage/db';
import type { Page, LLMSettings } from '../types/models';
import { rankByQuery } from './retrieval';
import { stripSiteName } from './related';

export class KnowledgeService {
  private llm: LLMService;

  constructor(settings: LLMSettings) {
    this.llm = new LLMService(settings);
  }

  /**
   * Turn a saved page's key points into knowledge notes. Until 2.1 this was a
   * second AI request per save; the analysis already has the key points, so this
   * halves the requests per save (which matters on Gemini's free-tier limits) and
   * can't fail after the page itself was saved.
   */
  async processPage(page: Page, workspaceId: number | null = null): Promise<void> {
    const targetWorkspaceId = workspaceId ?? (await defaultWorkspaceId());
    const topic = stripSiteName(page.title || '') || page.title || page.url;
    const points = (page.keyPoints || []).filter((p) => typeof p === 'string' && p.trim());
    const contents = points.length ? points : [page.summary || page.title || page.url];
    await db.knowledge.bulkAdd(
      contents.map((content) => ({
        topic,
        content,
        sourcePages: [page.id!],
        lastUpdated: new Date(),
        confidence: 0.9,
        tags: page.topics || [],
        workspaceId: targetWorkspaceId,
      }))
    );
  }

  /**
   * Answer a question from saved reading. Pages are ranked locally (see
   * retrieval.ts) using their title, topics, summary, key points and notes, and
   * only the best few go to the AI, in one request, with numbered sources.
   *
   * If no words match (a differently worded or very general question, such as
   * "what did I read this week?"), the most recent pages go instead and the AI
   * says whether they answer it, rather than refusing locally.
   */
  async queryKnowledge(
    query: string,
    knowledgeItems: Knowledge[],
    { allPages = false }: { allPages?: boolean } = {}
  ): Promise<KnowledgeAnswer> {
    const notesByPage = new Map<number, Knowledge[]>();
    for (const k of knowledgeItems) {
      const id = k.sourcePages?.[0];
      if (id === undefined) continue;
      if (!notesByPage.has(id)) notesByPage.set(id, []);
      notesByPage.get(id)!.push(k);
    }
    // Across all workspaces, search every saved page: before 2.1 a page could be
    // saved without notes (the second AI request failed), and it should still count.
    const pages = allPages
      ? await db.pages.toArray()
      : (await db.pages.bulkGet([...notesByPage.keys()])).filter((p): p is Page => !!p);
    if (pages.length === 0) {
      return { relevantKnowledge: [], sources: [], synthesizedAnswer: 'Nothing saved here yet. Save a few pages first, then ask about them.' };
    }

    const ranked = rankByQuery(query, pages, (p) => {
      const notes = notesByPage.get(p.id!) || [];
      return [
        [p.title, 2],
        [(p.topics || []).join(' '), 2],
        [p.summary, 1],
        [(p.keyPoints || []).join(' '), 1],
        [notes.map((k) => `${k.topic} ${k.content} ${(k.tags || []).join(' ')}`).join(' '), 1],
      ];
    }, MAX_CONTEXT_PAGES).map((r) => r.item);

    const matched = ranked.length > 0;
    const chosen = matched
      ? ranked
      : [...pages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, MAX_CONTEXT_PAGES);

    const sources: KnowledgeSource[] = chosen.map((p) => ({ pageId: p.id!, title: p.title || p.url, url: p.url }));
    const context = chosen
      .map((p, i) => {
        const points = new Set<string>([...(p.keyPoints || []), ...(notesByPage.get(p.id!) || []).map((k) => k.content)]);
        const lines = [`[${i + 1}] ${p.title || p.url}`];
        if (p.summary) lines.push(`Summary: ${p.summary.slice(0, 700)}`);
        if (points.size) lines.push(...[...points].slice(0, 8).map((x) => `- ${x}`));
        return lines.join('\n');
      })
      .join('\n\n');

    const prompt = `Answer the question using only the notes below, which come from pages the user has read and saved.
${matched ? '' : "\nNone of the notes share words with the question, so these are the user's most recent pages. They may or may not be relevant.\n"}
Notes:
${context}

Question: ${query}

Rules:
- Use only the notes. If they don't answer the question, say so in one sentence and mention what the notes do cover.
- Cite sources inline with their numbers, like [1] or [2][3].
- Plain text, no JSON, no markdown headings. Keep it concise.`;

    const answer = (await this.llm.analyze(prompt)).trim();

    // Only list sources the answer actually cites, keeping their numbers.
    const cited = sources.map((s, i) => ({ s, n: i + 1 })).filter(({ n }) => new RegExp(`\\[${n}\\]`).test(answer));
    const relevantKnowledge = (cited.length ? cited.map((c) => c.s.pageId) : matched ? chosen.map((p) => p.id!) : [])
      .flatMap((id) => notesByPage.get(id) || []);

    return {
      relevantKnowledge,
      sources: cited.length ? cited.map((c) => ({ ...c.s, number: c.n })) : [],
      synthesizedAnswer: answer || 'Unable to generate an answer from your saved reading.',
    };
  }
}

/** Pages sent to the AI per question. Keeps requests small however much is saved. */
const MAX_CONTEXT_PAGES = 8;

async function defaultWorkspaceId(): Promise<number> {
  const existing = await db.workspaces.where('name').equals('Default').first();
  if (existing?.id) return existing.id;
  return (await db.workspaces.add({
    name: 'Default',
    description: 'Default workspace',
    color: '#4299E1',
    createdAt: new Date(),
    lastAccessed: new Date(),
  })) as number;
}

export interface KnowledgeSource {
  pageId: number;
  title: string;
  url: string;
  /** The number the answer cites it by, e.g. 2 for [2]. */
  number?: number;
}

export interface KnowledgeAnswer {
  relevantKnowledge: Knowledge[];
  sources: KnowledgeSource[];
  synthesizedAnswer: string;
}
