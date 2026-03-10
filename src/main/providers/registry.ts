import type { ILLMProvider } from './types';

class ProviderRegistry {
  private providers = new Map<string, ILLMProvider>();

  register(provider: ILLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): ILLMProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): ILLMProvider[] {
    return Array.from(this.providers.values());
  }

  getDefault(): ILLMProvider | undefined {
    return this.providers.get('claude');
  }
}

export const providerRegistry = new ProviderRegistry();
