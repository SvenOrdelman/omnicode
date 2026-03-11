import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FrequentPrompt {
  id: string;
  title: string;
  message: string;
  createdAt: number;
  updatedAt: number;
}

interface PromptInput {
  title: string;
  message: string;
}

interface FrequentPromptsState {
  prompts: FrequentPrompt[];
  addPrompt: (input: PromptInput) => FrequentPrompt;
  updatePrompt: (id: string, input: PromptInput) => void;
  deletePrompt: (id: string) => void;
}

function createPromptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeInput(input: PromptInput): PromptInput {
  return {
    title: input.title.trim(),
    message: input.message.trim(),
  };
}

export const useFrequentPromptsStore = create<FrequentPromptsState>()(
  persist(
    (set) => ({
      prompts: [],
      addPrompt: (input) => {
        const normalized = normalizeInput(input);
        const timestamp = Date.now();
        const prompt: FrequentPrompt = {
          id: createPromptId(),
          title: normalized.title,
          message: normalized.message,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set((state) => ({ prompts: [prompt, ...state.prompts] }));
        return prompt;
      },
      updatePrompt: (id, input) => {
        const normalized = normalizeInput(input);
        const timestamp = Date.now();

        set((state) => ({
          prompts: state.prompts.map((prompt) =>
            prompt.id === id
              ? {
                  ...prompt,
                  title: normalized.title,
                  message: normalized.message,
                  updatedAt: timestamp,
                }
              : prompt
          ),
        }));
      },
      deletePrompt: (id) =>
        set((state) => ({
          prompts: state.prompts.filter((prompt) => prompt.id !== id),
        })),
    }),
    {
      name: 'omnicode-frequent-prompts',
      partialize: (state) => ({
        prompts: state.prompts,
      }),
    }
  )
);
