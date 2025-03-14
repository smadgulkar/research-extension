import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { db } from '@/storage/db';
import { debounce } from 'lodash';
import type { Page } from '@/types/models';

interface SearchBarProps {
  onResultsChange: (results: Page[]) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onResultsChange }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const searchPages = debounce(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      const allPages = await db.pages.orderBy('timestamp').reverse().toArray();
      onResultsChange(allPages);
      return;
    }

    setIsSearching(true);
    try {
      const results = await db.pages
        .filter((page: Page) => 
          page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (page.summary && page.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (Array.isArray(page.topics) && page.topics.some((topic: string) => 
            topic.toLowerCase().includes(searchQuery.toLowerCase())
          ))
        )
        .toArray();
      onResultsChange(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, 300);

  useEffect(() => {
    searchPages(query);
    return () => searchPages.cancel();
  }, [query]);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search size={16} className="absolute left-3 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pages..."
          className="w-full pl-9 pr-8 py-2 border rounded-lg"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 p-1 hover:bg-gray-100 rounded-full"
          >
            <X size={14} className="text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;