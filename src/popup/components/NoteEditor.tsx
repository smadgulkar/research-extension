import React, { useState } from 'react';
import { X } from 'lucide-react';

interface NoteEditorProps {
  onSave: (note: string) => void;
  onClose: () => void;
  initialNote?: string;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ onSave, onClose, initialNote = '' }) => {
  const [note, setNote] = useState(initialNote);

  const handleSave = () => {
    onSave(note);
    onClose();
  };

  return (
    <div className="fixed z-50 bg-white rounded-lg shadow-lg border p-4 w-72">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-medium">Add Note</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
          <X size={16} />
        </button>
      </div>
      
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full h-24 p-2 border rounded-lg mb-3 text-sm"
        placeholder="Add your note here..."
        autoFocus
      />
      
      <div className="flex justify-end space-x-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save Note
        </button>
      </div>
    </div>
  );
};

export default NoteEditor;