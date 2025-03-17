import React, { useEffect, useRef } from 'react';

const BuyMeButton: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (containerRef.current) {
      // Clear any existing content
      containerRef.current.innerHTML = '';
      
      // Create script element
      const script = document.createElement('script');
      script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';
      script.setAttribute('data-name', 'bmc-button');
      script.setAttribute('data-slug', 'smadgulkar');
      script.setAttribute('data-color', '#5F7FFF');
      script.setAttribute('data-emoji', '🍕');
      script.setAttribute('data-font', 'Arial');
      script.setAttribute('data-text', 'Buy me a pizza');
      script.setAttribute('data-outline-color', '#000000');
      script.setAttribute('data-font-color', '#ffffff');
      script.setAttribute('data-coffee-color', '#FFDD00');
      
      // Append script to container
      containerRef.current.appendChild(script);
    }
  }, []);
  
  return <div ref={containerRef} className="bmc-container"></div>;
};

export default BuyMeButton; 