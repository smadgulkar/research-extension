import React from 'react';

/** "blog.example.com" from a URL, without "www.". */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * A small rounded tile with the site's first letter. Used instead of fetching
 * favicons, which would tell a third party which sites the user has saved.
 */
export const SiteTile: React.FC<{ url: string; size?: number }> = ({ url, size = 28 }) => {
  const host = hostOf(url);
  const letter = (host.match(/[a-z0-9]/i)?.[0] || '•').toUpperCase();
  let hash = 0;
  for (const ch of host) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hues = [210, 230, 260, 190, 160, 20, 330, 280];
  const hue = hues[hash % hues.length];
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-lg font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `hsl(${hue} 90% 95%)`,
        color: `hsl(${hue} 60% 38%)`,
      }}
    >
      {letter}
    </span>
  );
};
