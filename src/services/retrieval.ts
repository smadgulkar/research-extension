/**
 * Local ranking for knowledge Q&A (BM25 over topic, content and tags).
 *
 * Before 2.1 every question sent the whole knowledge base to the AI to pick
 * relevant items, which got slower and more expensive as the knowledge base
 * grew and eventually exceeded the model's input limit. Ranking locally is free,
 * private and keeps each request small however much the user has saved.
 *
 * Purely lexical: it matches words (with light stemming), not meanings.
 * Embeddings can replace the scorer later without changing callers.
 */

const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can could did do does for from had has have how i if in into is it its ' +
    'me my of on or our so than that the their them then there these they this to was we were what when where ' +
    'which who whom why will with would you your about any all also am just more most not only other over same ' +
    'should some such too very tell explain know read reading saved anything something things thing'
  ).split(' ')
);

/** Lowercase, split on anything that isn't a letter or digit, drop stopwords, light stemming. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/**
 * Light suffix stripping so word forms meet: turbine/turbines, embedding/embeddings,
 * database/databases all reduce to the same stem. Plural first, then -ing/-ed, then a final -e.
 */
export function stem(word: string): string {
  let t = word;
  if (t.length <= 3) return t;
  if (t.endsWith('ies') && t.length > 4) t = t.slice(0, -3) + 'y';
  else if (t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us') && !t.endsWith('is')) t = t.slice(0, -1);
  const before = t;
  if (t.endsWith('ing') && t.length >= 6) t = t.slice(0, -3);
  else if (t.endsWith('ed') && t.length >= 5) t = t.slice(0, -2);
  // running -> runn -> run (a doubled final consonant, except l, s and z)
  if (t !== before && t.length >= 4 && t[t.length - 1] === t[t.length - 2] && !'aeiouslz'.includes(t[t.length - 1])) {
    t = t.slice(0, -1);
  }
  if (t.endsWith('e') && t.length >= 4) t = t.slice(0, -1);
  return t;
}

export interface RankedResult<T> {
  item: T;
  score: number;
  /** How many distinct query terms the item contains. */
  matched: number;
}

/**
 * Rank items against a query. Returns at most `limit` items with a positive
 * score, best first. `fields` returns weighted text for each item; a weight of
 * 2 counts that text twice (used for topics).
 */
export function rankByQuery<T>(
  query: string,
  items: T[],
  fields: (item: T) => Array<[string, number]>,
  limit = 12
): RankedResult<T>[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0 || items.length === 0) return [];

  const docs = items.map((item) => {
    const tf = new Map<string, number>();
    let length = 0;
    for (const [text, weight] of fields(item)) {
      for (const term of tokenize(text || '')) {
        tf.set(term, (tf.get(term) || 0) + weight);
        length += weight;
      }
    }
    return { item, tf, length };
  });

  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const term of queryTerms) {
    df.set(term, docs.filter((d) => d.tf.has(term)).length);
  }

  const k1 = 1.2;
  const b = 0.75;
  const n = docs.length;

  return docs
    .map(({ item, tf, length }) => {
      let score = 0;
      let matched = 0;
      for (const term of queryTerms) {
        const f = tf.get(term);
        if (!f) continue;
        matched++;
        const idf = Math.log(1 + (n - df.get(term)! + 0.5) / (df.get(term)! + 0.5));
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * length) / avgLength));
      }
      return { item, score, matched };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
