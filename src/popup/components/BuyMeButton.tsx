import React from 'react';
import '../../styles/components/BuyMeButton.css';

const BuyMeButton: React.FC = () => {
  // Configuration extracted from the original script attributes
  const config = {
    slug: 'smadgulkar',
    buttonColor: '#5F7FFF',
    emoji: '🍕',
    font: 'Arial',
    text: 'Buy me a pizza',
    outlineColor: '#000000', // Used for border
    fontColor: '#ffffff',
    // coffeeColor: '#FFDD00', // This might be harder to replicate exactly without the script, often used for hover or internal icons.
  };

  const bmcUrl = `https://www.buymeacoffee.com/${config.slug}`;

  return (
    <a
      href={bmcUrl}
      target="_blank" // Open in a new tab
      rel="noopener noreferrer" // Security best practice for target="_blank"
      className="bmc-button"
      style={{
        backgroundColor: config.buttonColor,
        color: config.fontColor,
        borderColor: config.outlineColor, // Use outline color for border
        fontFamily: config.font,
      }}
    >
      {/* Optional: You could try adding an img tag here if you have a local coffee cup icon */}
      <span className="bmc-emoji">{config.emoji}</span>
      <span className="bmc-text">{config.text}</span>
    </a>
  );
};

export default BuyMeButton;