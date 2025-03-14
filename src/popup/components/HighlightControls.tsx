import React, { useState, useEffect } from 'react';
import { MessageCircle, Plus, Check } from 'lucide-react';
import { db } from '../../storage/db';

interface HighlightControlsProps {
  onColorSelect: (color: string) => void;
  onAddNote: () => void;
  onSave: () => void;
  selectedColor: string;
  position?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

const HighlightControls: React.FC<HighlightControlsProps> = ({
  onColorSelect,
  onAddNote,
  onSave,
  selectedColor,
  position
}) => {
  const [controlsStyle, setControlsStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    console.log('HighlightControls mounted', { position, selectedColor });
  }, []);

  useEffect(() => {
    console.log('Position changed:', position);
    if (position) {
      const controlsHeight = 40;
      const controlsWidth = 200;
      
      let top = position.top - controlsHeight - 10;
      let left = position.left + (position.width / 2) - (controlsWidth / 2);

      if (top < 10) top = position.top + position.height + 10;
      if (left < 10) left = 10;
      if (left + controlsWidth > window.innerWidth - 10) {
        left = window.innerWidth - controlsWidth - 10;
      }

      setControlsStyle({
        position: 'fixed',
        top,
        left,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      });
    }
  }, [position]);

  const handleSave = async () => {
    console.log('Save button clicked');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      console.error('No active tab found');
      return;
    }

    console.log('Sending CREATE_HIGHLIGHT message');
    chrome.tabs.sendMessage(tab.id, {
      type: 'CREATE_HIGHLIGHT',
      color: selectedColor
    }, (response) => {
      console.log('Received response:', response);
      if (response?.success && response.highlight) {
        db.highlights.add(response.highlight)
          .then(() => {
            console.log('Highlight saved to database');
            onSave();
          })
          .catch(error => console.error('Error saving highlight:', error));
      }
    });
  };

  if (!position) {
    console.log('No position, not rendering controls');
    return null;
  }

  return (
    <div 
      className="fixed bg-white rounded-lg shadow-lg border p-2 flex items-center gap-2"
      style={controlsStyle}
    >
      <button
        onClick={handleSave}
        className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 
          flex items-center gap-1 text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Highlight
      </button>
    </div>
  );
};

export default HighlightControls;