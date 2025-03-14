// src/popup/index.tsx
console.log('Script loaded');

import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tailwind.css';
import '@/styles/modern.css';
import '@/styles/highlight.css';
import App from './App';

console.log('Imports completed');

const container = document.getElementById('root');
console.log('Looking for root element:', container);

if (!container) {
    console.error('Failed to find root element');
    throw new Error('Failed to find the root element');
}

const root = createRoot(container);
console.log('Root created');

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
console.log('Render called');