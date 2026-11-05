import React, { useState, useEffect } from 'react';
import { X, Copy, Download, Check, Share2, BookOpen, ChevronDown, Crown, FileText } from 'lucide-react';
import { exportService, openInObsidian, getObsidianVaults, saveObsidianVault } from '../../services/exportService';
import { premiumService } from '../../services/premiumService';
import { notionService } from '../../services/notionService';
import { PremiumBadge, UpgradePrompt } from './PremiumBadge';
import type { ExportFormat } from '../../types/models';

interface SummaryDisplayProps {
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: string;
  title: string;
  url: string;
  onClose: () => void;
}

const EXPORT_FORMATS: { value: ExportFormat; label: string; premium: boolean }[] = [
  { value: 'markdown', label: 'Markdown', premium: false },
  { value: 'json', label: 'JSON', premium: true },
  { value: 'html', label: 'HTML', premium: true },
  { value: 'obsidian', label: 'Obsidian', premium: true },
];

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
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [notionConnected, setNotionConnected] = useState(false);
  const [exportingToNotion, setExportingToNotion] = useState(false);

  useEffect(() => {
    premiumService.isPremium().then(setIsPremium);
    notionService.isConnected().then(setNotionConnected);
  }, []);

  const analysisData = {
    title,
    url,
    summary,
    keyPoints,
    topics,
    sentiment,
    timestamp: new Date()
  };

  const handleCopy = async () => {
    try {
      const content = await exportService.exportAnalysis(analysisData, exportFormat);
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if (error instanceof Error && error.message.includes('premium')) {
        setShowUpgradePrompt(true);
      } else {
        console.error('Copy failed:', error);
      }
    }
  };

  const handleDownload = async () => {
    try {
      const content = await exportService.exportAnalysis(analysisData, exportFormat);
      const extension = exportService.getFileExtension(exportFormat);
      const mimeType = exportService.getMimeType(exportFormat);
      const filename = `${title.slice(0, 50).replace(/[^a-z0-9]/gi, '-')}-analysis.${extension}`;
      exportService.downloadFile(content, filename, mimeType);
    } catch (error) {
      if (error instanceof Error && error.message.includes('premium')) {
        setShowUpgradePrompt(true);
      } else {
        console.error('Download failed:', error);
      }
    }
  };

  const handleFormatSelect = (format: ExportFormat, isPremiumFormat: boolean) => {
    if (isPremiumFormat && !isPremium) {
      setShowUpgradePrompt(true);
      return;
    }
    setExportFormat(format);
    setShowFormatDropdown(false);
  };

  // Check if Web Share API is available
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const handleOpenInObsidian = async () => {
    if (!isPremium) {
      setShowUpgradePrompt(true);
      return;
    }
    try {
      await openInObsidian(analysisData);
    } catch (error) {
      if (error instanceof Error && error.message.includes('premium')) {
        setShowUpgradePrompt(true);
      } else {
        console.error('Obsidian open failed:', error);
      }
    }
  };

  const handleExportToNotion = async () => {
    if (!isPremium) {
      setShowUpgradePrompt(true);
      return;
    }
    if (!notionConnected) {
      alert('Please connect to Notion in Settings > Integrations first');
      return;
    }
    setExportingToNotion(true);
    try {
      const result = await notionService.exportToNotion(analysisData);
      window.open(result.url, '_blank');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('premium')) {
          setShowUpgradePrompt(true);
        } else {
          alert(error.message);
        }
      }
    } finally {
      setExportingToNotion(false);
    }
  };

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
        
        <div className="px-4 py-3 border-t flex flex-wrap gap-2 justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Export as:</span>
            <div className="relative">
              <button
                onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {EXPORT_FORMATS.find(f => f.value === exportFormat)?.label}
                <ChevronDown size={14} />
              </button>
              {showFormatDropdown && (
                <div className="absolute bottom-full left-0 mb-1 bg-white border rounded-lg shadow-lg py-1 min-w-[140px] z-10">
                  {EXPORT_FORMATS.map((format) => (
                    <button
                      key={format.value}
                      onClick={() => handleFormatSelect(format.value, format.premium)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between ${
                        exportFormat === format.value ? 'bg-gray-50 text-primary' : ''
                      }`}
                    >
                      <span>{format.label}</span>
                      {format.premium && !isPremium && (
                        <Crown size={12} className="text-amber-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {copied ? <Check size={14} className="mr-1 text-green-500" /> : <Copy size={14} className="mr-1" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center px-3 py-1.5 text-sm bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
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
            <button
              onClick={handleOpenInObsidian}
              className={`flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isPremium
                  ? 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
              }`}
              title={isPremium ? 'Open in Obsidian' : 'Premium feature'}
            >
              <FileText size={14} className="mr-1" />
              Obsidian
              {!isPremium && <Crown size={10} className="ml-1 text-amber-500" />}
            </button>
            <button
              onClick={handleExportToNotion}
              disabled={exportingToNotion}
              className={`flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isPremium && notionConnected
                  ? 'bg-gray-800 hover:bg-black text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
              }`}
              title={!isPremium ? 'Premium feature' : !notionConnected ? 'Connect Notion in Settings' : 'Export to Notion'}
            >
              {exportingToNotion ? (
                <>Exporting...</>
              ) : (
                <>
                  <span className="mr-1 font-bold">N</span>
                  Notion
                  {!isPremium && <Crown size={10} className="ml-1 text-amber-500" />}
                </>
              )}
            </button>
          </div>
        </div>
        {showUpgradePrompt && (
          <UpgradePrompt
            feature={`${EXPORT_FORMATS.find(f => f.value === exportFormat)?.label} export`}
            onClose={() => setShowUpgradePrompt(false)}
          />
        )}
      </div>
    </div>
  );
};

export default SummaryDisplay;