import type { OmniCodeAPI } from '../../preload/preload';

declare global {
  interface Window {
    omnicode: OmniCodeAPI;
  }
}

export const ipc = () => window.omnicode;
