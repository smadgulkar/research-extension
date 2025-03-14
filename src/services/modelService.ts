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
  
  private getFallbackModels(): Model[] {
    // Fallback models if API calls fail
    if (this.settings.provider.toLowerCase() === 'openai') {
      return [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
      ];
    } else {
      return [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
      ];
    }
  }
} 