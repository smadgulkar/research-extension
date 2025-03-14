# Research Assistant Extension Documentation

## Overview
Research Assistant is a browser extension that helps users analyze web content, extract key information, and build a personal knowledge base. It uses AI to summarize content, identify key points, and organize information for better research and learning.

## Features

### 1. Page Analysis
- **Content Extraction**: Automatically extracts content from the current webpage
- **AI-Powered Analysis**: Uses OpenAI or Anthropic models to analyze page content
- **Summary Generation**: Creates concise summaries of web pages
- **Key Points Extraction**: Identifies and lists the most important points from the content
- **Topic Identification**: Tags content with relevant topics for better organization
- **Sentiment Analysis**: Determines the overall sentiment of the content

### 2. Knowledge Base
- **Automatic Knowledge Extraction**: Extracts factual knowledge from analyzed pages
- **Topic Organization**: Organizes knowledge by topics for easy retrieval
- **Confidence Scoring**: Assigns confidence scores to extracted knowledge
- **Search Functionality**: Allows searching through accumulated knowledge
- **Question Answering**: Answers questions based on your knowledge base
- **Knowledge Visualization**: Displays knowledge items with metadata and source information

### 3. History Management
- **Page History**: Keeps track of all analyzed pages
- **Filtering**: Filter history by date range or topics
- **Search**: Search through your history to find specific pages
- **Quick Access**: Easily access previously analyzed content

### 4. Export and Sharing
- **Copy to Clipboard**: Copy summaries, key points, or topics to clipboard
- **Download as Markdown**: Download analysis results as markdown files
- **Web Share API**: Share analysis results (on supported browsers)

### 5. Settings and Configuration
- **LLM Provider Selection**: Choose between OpenAI and Anthropic
- **API Key Management**: Securely store your API keys
- **Model Selection**: Dynamically fetches and displays available models
- **UI Customization**: Modern, clean interface with Material Design principles

## Technical Implementation

### Core Services
- **LLMService**: Handles communication with AI providers (OpenAI/Anthropic)
- **ContentAnalyzer**: Extracts and preprocesses page content
- **KnowledgeService**: Manages knowledge extraction and storage
- **ModelService**: Fetches available models from providers

### Data Storage
- **IndexedDB**: Stores analyzed pages, extracted knowledge, and settings
- **Local Storage**: Caches frequently accessed data for performance

### UI Components
- **Tab Navigation**: Easy navigation between Analyze, History, and Knowledge tabs
- **SummaryDisplay**: Modal component for viewing and sharing analysis results
- **KnowledgeExplorer**: Interface for exploring and querying the knowledge base
- **Settings Modal**: Configuration interface for the extension

## How to Use

1. **Analyze a Page**:
   - Navigate to any webpage
   - Open the extension
   - Click "Analyze Page"
   - View the summary, key points, and topics

2. **Build Your Knowledge Base**:
   - Analyze pages of interest
   - Knowledge is automatically extracted and stored
   - Go to the Knowledge tab to explore extracted knowledge

3. **Search Your Knowledge**:
   - In the Knowledge tab, use the search bar
   - Ask questions or search for specific topics
   - View relevant knowledge items and synthesized answers

4. **Review History**:
   - Go to the History tab to see all analyzed pages
   - Filter by date or topics
   - Click on any page to revisit it

5. **Configure Settings**:
   - Click the settings icon
   - Enter your API key for OpenAI or Anthropic
   - Select your preferred model
   - Save settings

## Technical Requirements
- Chrome/Edge browser (v88+)
- OpenAI or Anthropic API key
- Internet connection for API calls

## Privacy and Security
- API keys are stored locally and never sent to any server except the respective AI provider
- All processing happens locally in the browser or through direct API calls
- No user data is collected or stored outside the local browser storage 