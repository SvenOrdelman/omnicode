import { create } from 'zustand';

interface AuthState {
  installed: boolean;
  authenticated: boolean;
  account: string | undefined;
  isLoggingIn: boolean;
  setAuthStatus: (status: { installed: boolean; authenticated: boolean; account?: string }) => void;
  setIsLoggingIn: (loggingIn: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  installed: false,
  authenticated: false,
  account: undefined,
  isLoggingIn: false,
  setAuthStatus: ({ installed, authenticated, account }) =>
    set({ installed, authenticated, account }),
  setIsLoggingIn: (loggingIn) => set({ isLoggingIn: loggingIn }),
}));
