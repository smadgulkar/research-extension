import React from 'react';
import { MessageCircle } from 'lucide-react';

const FeedbackButton: React.FC = () => {
  const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSeR0egGYS2sx28ZpEsPpH0cV7GGkJxp_QaH0PRgyLfbupSpPg/viewform';

  return (
    <a
      href={formUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors"
    >
      <MessageCircle size={13} />
      Send Feedback
    </a>
  );
};

export default FeedbackButton; 