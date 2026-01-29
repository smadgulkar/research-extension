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
      
      // Filter for chat models only
      return data.data
        .filter((model: any) => 
          model.id.includes('gpt') && 
          !model.id.includes('instruct') &&
          !model.id.includes('-if')
        )
        .map((model: any) => ({
          id: model.id,
          name: model.id.replace('gpt-', 'GPT ').replace('-turbo', ' Turbo'),
          created: model.created
        }))
        .sort((a: Model, b: Model) => (b.created || 0) - (a.created || 0));
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      throw error;
    }
  }
  
  private async getAnthropicModels(): Promise<Model[]> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Ensure we're accessing the correct property in the response
      const models = data.data || [];
      
      return models.map((model: any) => ({
        id: model.id,
        name: this.formatAnthropicModelName(model.id),
        description: model.description
      }));
    } catch (error) {
      console.error('Error fetching Anthropic models:', error);
      // Return fallback models on error
      return this.getFallbackModels();
    }
  }
  
  private formatAnthropicModelName(modelId: string): string {
    return modelId
      .replace('claude-', 'Claude ')
      .replace(/-(\d+)/, ' $1')
      .replace(/(\d{4})(\d{2})(\d{2})/, '') // Remove date suffix
      .trim();
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

      // Filter for generative models only
      return data.models
        .filter((model: any) =>
          model.name.includes('gemini') &&
          model.supportedGenerationMethods?.includes('generateContent')
        )
        .map((model: any) => ({
          id: model.name.replace('models/', ''),
          name: this.formatGeminiModelName(model.displayName || model.name),
          description: model.description
        }));
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      return this.getFallbackModels();
    }
  }

  private formatGeminiModelName(name: string): string {
    return name
      .replace('models/', '')
      .replace('gemini-', 'Gemini ')
      .replace('-', ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private getFallbackModels(): Model[] {
    // Fallback models if API calls fail
    switch (this.settings.provider.toLowerCase()) {
      case 'openai':
        return [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
          { id: 'gpt-4', name: 'GPT-4' }
        ];
      case 'anthropic':
        return [
          { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
          { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
          { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' }
        ];
      case 'gemini':
        return [
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
          { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B' }
        ];
      default:
        return [];
    }
  }
} 