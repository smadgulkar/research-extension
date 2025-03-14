import React, { useState } from 'react';
import { X, Copy, Download, Check, Share2, BookOpen } from 'lucide-react';

interface SummaryDisplayProps {
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  title: string;
  url: string;
  onClose: () => void;
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  summary,
  keyPoints,
  topics,
  sentiment,
  title,
  url,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'keyPoints' | 'topics'>('summary');

  const handleCopy = async () => {
    let textToCopy = '';
    
    if (activeTab === 'summary') {
      textToCopy = `# ${title}\n\n${summary}\n\nSource: ${url}`;
    } else if (activeTab === 'keyPoints') {
      textToCopy = `# Key Points from ${title}\n\n${keyPoints.map(point => `• ${point}`).join('\n')}\n\nSource: ${url}`;
    } else {
      textToCopy = `# Topics from ${title}\n\n${topics.join(', ')}\n\nSentiment: ${sentiment}\n\nSource: ${url}`;
    }
    
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    let content = '';
    let filename = '';
    
    if (activeTab === 'summary') {
      content = `# ${title}\n\n${summary}\n\nSource: ${url}`;
      filename = 'summary.md';
    } else if (activeTab === 'keyPoints') {
      content = `# Key Points from ${title}\n\n${keyPoints.map(point => `• ${point}`).join('\n')}\n\nSource: ${url}`;
      filename = 'key-points.md';
    } else {
      content = `# Topics from ${title}\n\n${topics.join(', ')}\n\nSentiment: ${sentiment}\n\nSource: ${url}`;
      filename = 'topics.md';
    }
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  // Check if Web Share API is available
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-card w-[700px] max-w-full max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-primary-dark flex items-center">
            <BookOpen size={18} className="mr-2" />
            Analysis Results
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="px-4 py-2 border-b flex">
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'summary' ? 'text-primary border-b-2 border-primary' : 'text-gray-600'}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'keyPoints' ? 'text-primary border-b-2 border-primary' : 'text-gray-600'}`}
            onClick={() => setActiveTab('keyPoints')}
          >
            Key Points
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'topics' ? 'text-primary border-b-2 border-primary' : 'text-gray-600'}`}
            onClick={() => setActiveTab('topics')}
          >
            Topics
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mb-4 block truncate">
            {url}
          </a>
          
          {activeTab === 'summary' && (
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <p className="text-sm leading-relaxed mono-text whitespace-pre-wrap">{summary}</p>
            </div>
          )}
          
          {activeTab === 'keyPoints' && (
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <ul className="list-disc pl-5 space-y-2">
                {keyPoints.map((point, idx) => (
                  <li key={idx} className="text-sm mono-text">{point}</li>
                ))}
              </ul>
            </div>
          )}
          
          {activeTab === 'topics' && (
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {topics.map((topic, idx) => (
                  <span key={idx} className="topic-pill">{topic}</span>
                ))}
              </div>
              <p className="text-sm mono-text mt-4">
                <span className="font-medium">Sentiment:</span> {sentiment}
              </p>
            </div>
          )}
        </div>
        
        <div className="px-4 py-3 border-t flex justify-between">
          <div className="text-xs text-gray-500">
            Analyzed with Research Assistant
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {copied ? <Check size={14} className="mr-1 text-green-500" /> : <Copy size={14} className="mr-1" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Download size={14} className="mr-1" />
              Download
            </button>
            {canShare && (
              <button
                onClick={() => {
                  navigator.share({
                    title: `Analysis of ${title}`,
                    text: summary,
                    url: url
                  });
                }}
                className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Share2 size={14} className="mr-1" />
                Share
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryDisplay;