// Export service for different formats
import type { ExportFormat, Page, Knowledge } from '../types/models';
import { premiumService } from './premiumService';

interface AnalysisData {
  title: string;
  url: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  timestamp?: Date;
}

class ExportService {
  // Export analysis to specified format
  async exportAnalysis(data: AnalysisData, format: ExportFormat): Promise<string> {
    const isAvailable = await premiumService.isExportFormatAvailable(format);
    if (!isAvailable) {
      throw new Error(`Export format "${format}" requires premium subscription`);
    }

    switch (format) {
      case 'markdown':
        return this.toMarkdown(data);
      case 'json':
        return this.toJSON(data);
      case 'html':
        return this.toHTML(data);
      case 'obsidian':
        return this.toObsidian(data);
      case 'notion':
        throw new Error('Notion export requires OAuth integration. Use exportToNotion() instead.');
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  // Markdown export (free)
  toMarkdown(data: AnalysisData): string {
    const lines: string[] = [];

    lines.push(`# ${data.title}`);
    lines.push('');
    lines.push(`> Source: ${data.url}`);
    if (data.timestamp) {
      lines.push(`> Analyzed: ${new Date(data.timestamp).toLocaleDateString()}`);
    }
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(data.summary);
    lines.push('');

    if (data.keyPoints.length > 0) {
      lines.push('## Key Points');
      lines.push('');
      data.keyPoints.forEach(point => {
        lines.push(`- ${point}`);
      });
      lines.push('');
    }

    if (data.topics.length > 0) {
      lines.push('## Topics');
      lines.push('');
      lines.push(data.topics.map(t => `\`${t}\``).join(' '));
      lines.push('');
    }

    if (data.sentiment) {
      lines.push(`**Sentiment:** ${data.sentiment}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('*Exported with Research Assistant*');

    return lines.join('\n');
  }

  // JSON export (premium)
  toJSON(data: AnalysisData): string {
    return JSON.stringify({
      title: data.title,
      url: data.url,
      summary: data.summary,
      keyPoints: data.keyPoints,
      topics: data.topics,
      sentiment: data.sentiment,
      analyzedAt: data.timestamp || new Date().toISOString(),
      exportedAt: new Date().toISOString(),
      source: 'Research Assistant'
    }, null, 2);
  }

  // HTML export (premium)
  toHTML(data: AnalysisData): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(data.title)} - Analysis</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #4361ee; padding-bottom: 0.5rem; }
    h2 { color: #16213e; margin-top: 2rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
    .meta a { color: #4361ee; }
    .summary { background: #f8f9fa; padding: 1rem; border-radius: 8px; }
    .key-points li { margin-bottom: 0.5rem; }
    .topic { display: inline-block; background: #e8eef9; color: #4361ee; padding: 0.25rem 0.75rem; border-radius: 20px; margin: 0.25rem; font-size: 0.85rem; }
    .sentiment { margin-top: 1rem; padding: 0.5rem 1rem; background: #f0f0f0; border-radius: 4px; }
    footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; color: #999; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(data.title)}</h1>
  <div class="meta">
    <a href="${this.escapeHtml(data.url)}" target="_blank">${this.escapeHtml(data.url)}</a>
    ${data.timestamp ? `<br>Analyzed: ${new Date(data.timestamp).toLocaleDateString()}` : ''}
  </div>

  <h2>Summary</h2>
  <div class="summary">
    <p>${this.escapeHtml(data.summary).replace(/\n/g, '</p><p>')}</p>
  </div>

  ${data.keyPoints.length > 0 ? `
  <h2>Key Points</h2>
  <ul class="key-points">
    ${data.keyPoints.map(point => `<li>${this.escapeHtml(point)}</li>`).join('\n    ')}
  </ul>
  ` : ''}

  ${data.topics.length > 0 ? `
  <h2>Topics</h2>
  <div class="topics">
    ${data.topics.map(topic => `<span class="topic">${this.escapeHtml(topic)}</span>`).join('')}
  </div>
  ` : ''}

  ${data.sentiment ? `<div class="sentiment"><strong>Sentiment:</strong> ${this.escapeHtml(data.sentiment)}</div>` : ''}

  <footer>Exported with Research Assistant</footer>
</body>
</html>`;
  }

  // Obsidian-compatible markdown (premium)
  toObsidian(data: AnalysisData): string {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`title: "${data.title.replace(/"/g, '\\"')}"`);
    lines.push(`source: "${data.url}"`);
    lines.push(`tags: [${data.topics.map(t => t.toLowerCase().replace(/\s+/g, '-')).join(', ')}]`);
    lines.push(`sentiment: ${data.sentiment}`);
    lines.push(`analyzed: ${(data.timestamp || new Date()).toISOString().split('T')[0]}`);
    lines.push('type: research-analysis');
    lines.push('---');
    lines.push('');

    // Content
    lines.push(`# ${data.title}`);
    lines.push('');
    lines.push(`> [!info] Source`);
    lines.push(`> ${data.url}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(data.summary);
    lines.push('');

    if (data.keyPoints.length > 0) {
      lines.push('## Key Points');
      lines.push('');
      data.keyPoints.forEach(point => {
        lines.push(`- ${point}`);
      });
      lines.push('');
    }

    if (data.topics.length > 0) {
      lines.push('## Related Topics');
      lines.push('');
      // Use wikilinks for topics
      lines.push(data.topics.map(t => `[[${t}]]`).join(' | '));
      lines.push('');
    }

    lines.push('---');
    lines.push(`**Sentiment:** ${data.sentiment}`);

    return lines.join('\n');
  }

  // Helper to escape HTML
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // Download file
  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Get file extension for format
  getFileExtension(format: ExportFormat): string {
    const extensions: Record<ExportFormat, string> = {
      markdown: 'md',
      json: 'json',
      html: 'html',
      obsidian: 'md',
      notion: 'md'
    };
    return extensions[format];
  }

  // Get MIME type for format
  getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      markdown: 'text/markdown',
      json: 'application/json',
      html: 'text/html',
      obsidian: 'text/markdown',
      notion: 'text/markdown'
    };
    return mimeTypes[format];
  }
}

// Obsidian URI handler
export const openInObsidian = async (data: AnalysisData, vaultName?: string): Promise<void> => {
  const isAvailable = await premiumService.isExportFormatAvailable('obsidian');
  if (!isAvailable) {
    throw new Error('Obsidian integration requires premium subscription');
  }

  const content = exportService.toObsidian(data);
  const fileName = data.title.slice(0, 50).replace(/[^a-z0-9]/gi, '-');

  // Build Obsidian URI
  const params = new URLSearchParams();
  if (vaultName) {
    params.set('vault', vaultName);
  }
  params.set('file', `Research/${fileName}`);
  params.set('content', content);

  const uri = `obsidian://new?${params.toString()}`;

  // Open Obsidian
  window.open(uri, '_blank');
};

// Get list of Obsidian vaults (stored in settings)
export const getObsidianVaults = async (): Promise<string[]> => {
  try {
    const result = await chrome.storage.local.get('obsidian_vaults');
    return result.obsidian_vaults || [];
  } catch {
    return [];
  }
};

// Save Obsidian vault name
export const saveObsidianVault = async (vaultName: string): Promise<void> => {
  const vaults = await getObsidianVaults();
  if (!vaults.includes(vaultName)) {
    vaults.push(vaultName);
    await chrome.storage.local.set({ obsidian_vaults: vaults });
  }
};

export const exportService = new ExportService();
