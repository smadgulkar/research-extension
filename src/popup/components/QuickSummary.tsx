import React, { useState } from 'react';
import { LLMService } from '@/services/llm';
import type { Settings } from '@/storage/db';

interface QuickSummaryProps {
  content: string;
  title: string;
  settings: Settings;
}

const QuickSummary: React.FC<QuickSummaryProps> = ({ content, title, settings }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const llm = new LLMService(settings);
      
      // Create a prompt that includes both content and title
      const prompt = `
        Please provide a concise summary (3-4 sentences) of the following content:
        
        Title: ${title}
        Content: ${content.substring(0, 3000)}...
      `;
      
      // Now we only pass the prompt to the analyze method
      const result = await llm.analyze(prompt);
      setSummary(result);
    } catch (err) {
      setError('Failed to generate summary. Please try again.');
      console.error('Summary generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium mb-3">Quick Summary</h3>
      
      {!summary && !isLoading && (
        <button
          onClick={generateSummary}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Generate Summary
        </button>
      )}
      
      {isLoading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Generating summary...</p>
        </div>
      )}
      
      {error && (
        <div className="text-red-500 mt-2">
          {error}
        </div>
      )}
      
      {summary && (
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700">{summary}</p>
        </div>
      )}
    </div>
  );
};

export default QuickSummary; 