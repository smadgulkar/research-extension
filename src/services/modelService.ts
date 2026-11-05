import type { LLMSettings } from '@/types/models';

interface Model {
  id: string;
  name?: string;
  created?: number;
  description?: string;
}

export class ModelService {
  private settings: LLMSettings;

  constructor(settings: LLMSettings) {
    this.settings = settings;
  }

  async getAvailableModels(): Promise<Model[]> {
    try {
      switch (this.settings.provider.toLowerCase()) {
        case 'openai':
          return this.getOpenAIModels();
        case 'anthropic':
          return this.getAnthropicModels();
        case 'gemini':
          return this.getGeminiModels();
        default:
          throw new Error(`Unsupported provider: ${this.settings.provider}`);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      return this.getFallbackModels();
    }
  }

  private async getOpenAIModels(): Promise<Model[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Filter for chat-capable models (gpt, o1, o3, chatgpt, etc.)
      // Exclude embeddings, tts, whisper, dall-e, and instruct models
      const chatModels = data.data
        .filter((model: any) => {
          const id = model.id.toLowerCase();
          // Include: gpt-*, o1-*, o3-*, chatgpt-*
          const isChat = id.startsWith('gpt-') ||
                         id.startsWith('o1') ||
                         id.startsWith('o3') ||
                         id.startsWith('chatgpt');
          // Exclude: instruct, embedding, realtime, audio
          const isExcluded = id.includes('instruct') ||
                             id.includes('embedding') ||
                             id.includes('realtime') ||
                             id.includes('audio') ||
                             id.includes('tts') ||
                             id.includes('whisper') ||
                             id.includes('dall-e');
          return isChat && !isExcluded;
        })
        .map((model: any) => ({
          id: model.id,
          name: this.formatOpenAIModelName(model.id),
          created: model.created
        }))
        .sort((a: Model, b: Model) => (b.created || 0) - (a.created || 0));

      return chatModels.length > 0 ? chatModels : this.getFallbackModels();
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      throw error;
    }
  }

  private formatOpenAIModelName(modelId: string): string {
    // Handle o1, o3 models
    if (modelId.startsWith('o1') || modelId.startsWith('o3')) {
      return modelId.toUpperCase().replace(/-/g, ' ').replace(/(\d{4}) (\d{2}) (\d{2})/, '');
    }
    // Handle chatgpt models
    if (modelId.startsWith('chatgpt')) {
      return modelId.replace('chatgpt-', 'ChatGPT ').replace(/-/g, ' ');
    }
    // Handle gpt models
    return modelId
      .replace('gpt-', 'GPT-')
      .replace('-turbo', ' Turbo')
      .replace('-mini', ' Mini');
  }

  private async getAnthropicModels(): Promise<Model[]> {
    // Live list from Anthropic's Models API, so retired models never appear.
    try {
      const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        headers: {
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const data = await response.json();
      const models = (data.data || []).map((model: any) => ({
        id: model.id,
        name: model.display_name || model.id,
        created: model.created_at ? Date.parse(model.created_at) : undefined
      }));

      return models.length > 0 ? models : this.getFallbackModels();
    } catch (error) {
      console.error('Error fetching Anthropic models:', error);
      return this.getFallbackModels();
    }
  }

  private async getGeminiModels(): Promise<Model[]> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.settings.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Filter for text generation models
      const models = data.models
        .filter((model: any) => {
          const name = model.name.toLowerCase();
          // Include gemini models that support content generation
          return name.includes('gemini') &&
                 model.supportedGenerationMethods?.includes('generateContent');
        })
        .map((model: any) => ({
          id: model.name.replace('models/', ''),
          name: model.displayName || this.formatGeminiModelName(model.name),
          description: model.description
        }))
        // Sort by name to group similar models
        .sort((a: Model, b: Model) => {
          // Prioritize newer versions (2.0, 1.5, 1.0)
          const aVersion = a.id.match(/(\d+\.\d+)/)?.[1] || '0';
          const bVersion = b.id.match(/(\d+\.\d+)/)?.[1] || '0';
          return parseFloat(bVersion) - parseFloat(aVersion);
        });

      return models.length > 0 ? models : this.getFallbackModels();
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      return this.getFallbackModels();
    }
  }

  private formatGeminiModelName(name: string): string {
    return name
      .replace('models/', '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getFallbackModels(): Model[] {
    // Fallback models if API calls fail - keep these updated!
    switch (this.settings.provider.toLowerCase()) {
      case 'openai':
        return [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'o1', name: 'O1' },
          { id: 'o1-mini', name: 'O1 Mini' },
          { id: 'o3-mini', name: 'O3 Mini' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        ];
      case 'anthropic':
        return [
          { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
          { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
          { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' },
        ];
      case 'gemini':
        return [
          { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
          { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
          { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B' },
        ];
      default:
        return [];
    }
  }
}
