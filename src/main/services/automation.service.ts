import { shell } from 'electron';
import type { RemoteAutomationConfig } from '../../shared/automation-types';

const DEFAULT_AUTOMATIONS_URL = 'https://chatgpt.com';

function normalizeRemoteUrl(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error('Automation URL is empty');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Invalid automation URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Automation URL must use http or https');
  }

  return parsed.toString();
}

export function getRemoteAutomationConfig(): RemoteAutomationConfig {
  const configuredUrl = process.env.OMNICODE_AUTOMATIONS_URL?.trim();
  const fallbackUrl = process.env.CODEX_AUTOMATIONS_URL?.trim();
  const defaultUrl = configuredUrl || fallbackUrl || DEFAULT_AUTOMATIONS_URL;
  const url = normalizeRemoteUrl(defaultUrl);

  return { url };
}

export async function openRemoteAutomationUrl(rawValue?: string): Promise<{ ok: true; url: string }> {
  const url = rawValue ? normalizeRemoteUrl(rawValue) : getRemoteAutomationConfig().url;
  await shell.openExternal(url);
  return { ok: true, url };
}

export function normalizeAutomationUrl(rawValue: string): string {
  return normalizeRemoteUrl(rawValue);
}
