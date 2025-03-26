import React from 'react';
import { MessageCircle } from 'lucide-react';

const FeedbackButton: React.FC = () => {
  const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSeR0egGYS2sx28ZpEsPpH0cV7GGkJxp_QaH0PRgyLfbupSpPg/viewform';

  return (
    <a
      href={formUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 
                 text-white font-medium rounded-lg transition-colors"
    >
      <MessageCircle size={18} className="mr-2" />
      Send Feedback
    </a>
  );
};

export default FeedbackButton; 