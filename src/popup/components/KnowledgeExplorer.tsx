import React, { useState, useEffect } from 'react';
import { Search, Book, ArrowRight, ThumbsUp, ThumbsDown, Info, Database, Brain, X, Tag, Clock, Loader } from 'lucide-react';
import { db } from '@/storage/db';
import { KnowledgeService } from '@/services/knowledgeService';
import type { Knowledge } from '@/storage/db';
import KnowledgeGuide from './KnowledgeGuide';

interface KnowledgeExplorerProps {
  settings: any;
}

const KnowledgeExplorer: React.FC<KnowledgeExplorerProps> = ({ settings }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<Knowledge[]>([]);
  const [answer, setAnswer] = useState('');
  const [topTopics, setTopTopics] = useState<{topic: string, count: number}[]>([]);
  const [showInfo, setShowInfo] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    loadKnowledgeBase();
  }, []);

  const loadKnowledgeBase = async () => {
    try {
      const allKnowledge = await db.knowledge.toArray();
      
      // Get top topics
      const topicCounts: Record<string, number> = {};
      allKnowledge.forEach(item => {
        if (!topicCounts[item.topic]) {
          topicCounts[item.topic] = 0;
        }
        topicCounts[item.topic]++;
      });
      
      const sortedTopics = Object.entries(topicCounts)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      setTopTopics(sortedTopics);
      
      // Show recent knowledge items
      const recentItems = allKnowledge
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
        .slice(0, 10);
      
      setKnowledgeItems(recentItems);
    } catch (error) {
      console.error('Error loading knowledge base:', error);
    }
  };

  const searchKnowledge = async () => {
    if (!query.trim()) {
      await loadKnowledgeBase();
      return;
    }
    
    setIsSearching(true);
    try {
      const knowledgeService = new KnowledgeService(settings);
      const result = await knowledgeService.queryKnowledge(query);
      
      setKnowledgeItems(result.relevantKnowledge);
      setAnswer(result.synthesizedAnswer);
    } catch (error) {
      console.error('Knowledge search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Knowledge Base Info */}
      {showInfo && (
        <div className="enhanced-card bg-blue-50 border-l-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div className="flex items-start">
              <Info size={20} className="text-blue-500 mt-1 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-blue-800 mb-2">About Knowledge Base</h3>
                <p className="text-sm text-blue-800 mb-2">
                  The Knowledge Base automatically extracts and stores key information from your analyzed pages.
                </p>
                <ul className="text-sm text-blue-800 list-disc pl-5 mb-2">
                  <li>Search for specific topics or ask questions</li>
                  <li>Browse extracted knowledge by topic</li>
                  <li>Build a personal research database over time</li>
                </ul>
              </div>
            </div>
            <button 
              onClick={() => setShowInfo(false)}
              className="text-blue-500 hover:text-blue-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      
      {/* Search Section */}
      <div className="dashboard-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="mono-heading text-primary-dark">Knowledge Explorer</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowGuide(true)}
              className="text-xs text-primary-dark flex items-center hover:underline"
            >
              <Info size={12} className="mr-1" />
              How to use
            </button>
            <div className="flex items-center text-sm text-gray-500">
              <Database size={14} className="mr-1" />
              <span>{knowledgeItems.length} items</span>
            </div>
          </div>
        </div>
        
        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question or search knowledge..."
            className="w-full pl-10 pr-24 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all font-mono text-sm"
            onKeyDown={(e) => e.key === 'Enter' && searchKnowledge()}
          />
          <button 
            onClick={searchKnowledge}
            disabled={isSearching}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 gradient-button py-1 px-3 text-sm"
          >
            {isSearching ? (
              <>
                <Loader size={14} className="animate-spin mr-1" />
                Searching...
              </>
            ) : (
              <>Search</>
            )}
          </button>
        </div>
        
        {/* Popular Topics */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Tag size={14} className="mr-2" />
            Popular Topics
          </h3>
          <div className="flex flex-wrap">
            {topTopics.length > 0 ? (
              topTopics.map(topic => (
                <button 
                  key={topic.topic}
                  onClick={() => {
                    setQuery(topic.topic);
                    searchKnowledge();
                  }}
                  className="topic-pill"
                >
                  {topic.topic} ({topic.count})
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">No topics yet. Analyze pages to build your knowledge base.</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Answer Section */}
      {answer && (
        <div className="dashboard-section">
          <h2 className="mono-heading text-primary-dark mb-4 flex items-center">
            <Brain size={18} className="mr-2" />
            Answer
          </h2>
          <div className="enhanced-card bg-blue-50 border-l-4 border-blue-500">
            <p className="mono-text leading-relaxed">{answer}</p>
            <div className="flex justify-end mt-4 space-x-2">
              <button className="p-2 rounded-full hover:bg-blue-100 transition-colors">
                <ThumbsUp size={16} className="text-primary" />
              </button>
              <button className="p-2 rounded-full hover:bg-red-100 transition-colors">
                <ThumbsDown size={16} className="text-red-500" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Knowledge Items */}
      <div className="dashboard-section">
        <h2 className="mono-heading text-primary-dark mb-4 flex items-center">
          <Book size={18} className="mr-2" />
          Knowledge Items
        </h2>
        
        {knowledgeItems.length > 0 ? (
          <div className="space-y-4">
            {knowledgeItems.map((item) => (
              <div key={item.id} className="enhanced-card hover:bg-gray-50">
                <div className="flex items-start">
                  <div className="bg-primary-light rounded-full p-2 mr-3 flex-shrink-0">
                    <Book size={16} className="text-primary-dark" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mono-heading text-primary-dark mb-2">{item.topic}</h3>
                    <p className="mono-text text-sm mb-3 leading-relaxed">{item.content}</p>
                    <div className="flex flex-wrap items-center text-xs text-gray-500">
                      <span className="flex items-center mr-4">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                        Confidence: {Math.round(item.confidence * 100)}%
                      </span>
                      <span className="flex items-center">
                        <Clock size={12} className="mr-1" />
                        {new Date(item.lastUpdated).toLocaleDateString()}
                      </span>
                      {item.tags && item.tags.length > 0 && (
                        <div className="w-full mt-2 flex flex-wrap">
                          {item.tags.map((tag, idx) => (
                            <span key={idx} className="mr-2 mb-1 px-2 py-1 bg-gray-100 rounded-full text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Database size={40} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 font-medium">No knowledge items found</p>
            <p className="text-sm text-gray-400 mt-1">Analyze pages to build your knowledge base</p>
          </div>
        )}
      </div>
      {showGuide && <KnowledgeGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
};

export default KnowledgeExplorer; 