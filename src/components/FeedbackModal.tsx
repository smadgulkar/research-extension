import React, { useState } from 'react';
import { X } from 'lucide-react';

interface FeedbackModalProps {
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  const [feedbackType, setFeedbackType] = useState('bug');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Get browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        version: chrome.runtime.getManifest().version
      };

      // Create form URL with correct parameters
      const formUrl = new URL('https://docs.google.com/forms/d/e/1FAIpQLSeR0egGYS2sx28ZpEsPpH0cV7GGkJxp_QaH0PRgyLfbupSpPg/viewform');
      
      // Add form parameters with correct field mappings
      const params = new URLSearchParams();
      
      // Correctly map the fields
      params.append('entry.785579080', feedbackType);             // Feedback Type
      params.append('entry.264863422', description);              // Description
      params.append('entry.228801333', email || '');             // Email
      params.append('entry.1367377419', browserInfo.userAgent);   // Browser Info
      
      // Add extension version to description
      const fullDescription = `${description}\n\nExtension Version: ${browserInfo.version}`;
      params.set('entry.264863422', fullDescription);
      
      // Open form in new tab
      const fullUrl = `${formUrl.toString()}?${params.toString()}`;
      const newWindow = window.open(fullUrl, '_blank');
      
      if (newWindow) {
        // Close the modal only if the window was successfully opened
        onClose();
      } else {
        setError('Please allow popups to submit feedback');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      setError('Failed to open feedback form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Send Feedback</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Feedback Type
            </label>
            <select
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value)}
              className="w-full p-2 border rounded-lg"
              required
            >
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="knowledge">Knowledge Base Feedback</option>
              <option value="general">General Feedback</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded-lg h-32"
              required
              placeholder="Please describe your feedback..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded-lg"
              placeholder="For follow-up questions (optional)"
            />
          </div>

          {error && (
            <div className="mb-4 text-red-600 text-sm">{error}</div>
          )}

          <div className="text-xs text-gray-500 mb-4">
            By submitting feedback, you agree to share the provided information and basic system details 
            (browser version and extension version). No personal data or API keys will be collected.
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal; 