import React from 'react';
import { FileText, Clock, Tag } from 'lucide-react';
import { LLMService } from '@/services/llm';

interface QuickSummaryProps {
  content: string;
  title: string;
  onSummaryComplete: (summary: any) => void;
}

const QuickSummary: React.FC<QuickSummaryProps> = ({ content, title, onSummaryComplete }) => {
  const [summary, setSummary] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const generateQuickSummary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const llmService = new LLMService({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        apiKey: 'your-api-key'
      });

      const result = await llmService.analyze(content, title);
      setSummary(result.summary);
      onSummaryComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-lg font-medium text-gray-900">Quick Summary</h3>
        <button
          onClick={generateQuickSummary}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
            disabled:bg-blue-300 transition-colors font-mono text-sm"
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="text-error text-sm mb-3 font-mono">
          {error}
        </div>
      )}

      {summary && (
        <div className="prose prose-sm max-w-none">
          <p className="font-mono text-sm leading-relaxed text-gray-700">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
};

export default QuickSummary; 