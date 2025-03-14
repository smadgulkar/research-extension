import React from 'react';
import { X, Info, Database, Search, Brain, Book } from 'lucide-react';

interface KnowledgeGuideProps {
  onClose: () => void;
}

const KnowledgeGuide: React.FC<KnowledgeGuideProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-primary-dark flex items-center">
            <Info size={18} className="mr-2" />
            Knowledge Base Guide
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 space-y-6">
          <div>
            <h3 className="font-medium text-primary-dark mb-2 flex items-center">
              <Database size={16} className="mr-2" />
              What is the Knowledge Base?
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              The Knowledge Base is an intelligent system that automatically extracts, stores, and organizes key information from all the pages you analyze.
            </p>
            <p className="text-sm text-gray-700">
              Think of it as your personal research assistant that remembers everything you've read and can answer questions based on that knowledge.
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-primary-dark mb-2 flex items-center">
              <Search size={16} className="mr-2" />
              How to Use It
            </h3>
            <ul className="text-sm text-gray-700 space-y-3">
              <li className="flex">
                <span className="bg-primary-light text-primary-dark rounded-full w-5 h-5 flex items-center justify-center mr-2 flex-shrink-0">1</span>
                <span><strong>Analyze pages</strong> - Every time you analyze a page, key knowledge is automatically extracted and stored.</span>
              </li>
              <li className="flex">
                <span className="bg-primary-light text-primary-dark rounded-full w-5 h-5 flex items-center justify-center mr-2 flex-shrink-0">2</span>
                <span><strong>Ask questions</strong> - Type a question in the search bar to get answers based on your knowledge base.</span>
              </li>
              <li className="flex">
                <span className="bg-primary-light text-primary-dark rounded-full w-5 h-5 flex items-center justify-center mr-2 flex-shrink-0">3</span>
                <span><strong>Browse topics</strong> - Click on topic pills to explore related knowledge items.</span>
              </li>
              <li className="flex">
                <span className="bg-primary-light text-primary-dark rounded-full w-5 h-5 flex items-center justify-center mr-2 flex-shrink-0">4</span>
                <span><strong>Build over time</strong> - The more pages you analyze, the smarter your knowledge base becomes.</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-primary-dark mb-2 flex items-center">
              <Brain size={16} className="mr-2" />
              Example Questions
            </h3>
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <p className="text-sm text-gray-700">"What are the key benefits of quantum computing?"</p>
              <p className="text-sm text-gray-700">"Summarize what I've learned about climate change."</p>
              <p className="text-sm text-gray-700">"What did that article about neural networks say?"</p>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-primary-dark mb-2 flex items-center">
              <Book size={16} className="mr-2" />
              Knowledge Items
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              Each knowledge item contains:
            </p>
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li><strong>Topic</strong> - The subject of the knowledge</li>
              <li><strong>Content</strong> - The actual information or fact</li>
              <li><strong>Confidence</strong> - How certain the system is about this information</li>
              <li><strong>Tags</strong> - Related topics for better organization</li>
            </ul>
          </div>
          
          <button
            onClick={onClose}
            className="gradient-button w-full mt-4"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGuide; 