import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Globe, RefreshCw, Workflow } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Spinner } from '../common/Spinner';
import { ipc } from '../../lib/ipc-client';

const LOCAL_STORAGE_AUTOMATION_URL = 'omnicode:automations-url';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong.';
}

function normalizeUrlInput(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error('Enter an automation page URL.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are supported.');
  }
  return parsed.toString();
}

export function AutomationsPanel() {
  const [urlInput, setUrlInput] = useState('');
  const [iframeUrl, setIframeUrl] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [openingExternal, setOpeningExternal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setLoadingConfig(true);
      setErrorMsg('');

      try {
        const remoteConfig = await ipc().getRemoteAutomationConfig();
        const savedUrl = window.localStorage.getItem(LOCAL_STORAGE_AUTOMATION_URL);
        const initialInput = savedUrl?.trim() || remoteConfig.url;
        const normalized = normalizeUrlInput(initialInput);
        if (cancelled) return;
        setUrlInput(initialInput);
        setIframeUrl(normalized);
      } catch (error: unknown) {
        if (cancelled) return;
        setErrorMsg(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setLoadingConfig(false);
        }
      }
    };

    loadConfig().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const currentHost = useMemo(() => {
    try {
      return iframeUrl ? new URL(iframeUrl).host : '';
    } catch {
      return '';
    }
  }, [iframeUrl]);

  const handleLoadRemote = useCallback(() => {
    setErrorMsg('');

    try {
      const normalized = normalizeUrlInput(urlInput);
      setIframeUrl(normalized);
      window.localStorage.setItem(LOCAL_STORAGE_AUTOMATION_URL, normalized);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error));
    }
  }, [urlInput]);

  const handleOpenExternal = useCallback(async () => {
    setOpeningExternal(true);
    setErrorMsg('');

    try {
      const normalized = normalizeUrlInput(urlInput || iframeUrl);
      await ipc().openRemoteAutomation(normalized);
      window.localStorage.setItem(LOCAL_STORAGE_AUTOMATION_URL, normalized);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error));
    } finally {
      setOpeningExternal(false);
    }
  }, [iframeUrl, urlInput]);

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-1/50 glass px-6 py-3 [-webkit-app-region:drag]">
        <Workflow size={16} className="text-text-muted" />
        <h2 className="text-sm font-medium text-text-secondary">Automations</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex h-full max-w-5xl flex-col space-y-5">
          <section className="rounded-2xl border border-border-default bg-surface-2 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <Input
                label="Remote Automations Page"
                icon={Globe}
                placeholder="https://example.com/automations"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleLoadRemote();
                  }
                }}
              />

              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                onClick={handleLoadRemote}
                disabled={loadingConfig}
                className="sm:mb-0.5"
              >
                Load
              </Button>

              <Button
                size="sm"
                icon={ExternalLink}
                onClick={() => void handleOpenExternal()}
                disabled={loadingConfig || openingExternal}
                className="sm:mb-0.5"
              >
                {openingExternal ? 'Opening...' : 'Open External'}
              </Button>
            </div>

            {errorMsg && (
              <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {errorMsg}
              </p>
            )}

            {!errorMsg && currentHost && (
              <p className="mt-3 text-xs text-text-muted">
                Loaded host: <span className="text-text-secondary">{currentHost}</span>
              </p>
            )}
          </section>

          <section className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-1">
            {loadingConfig && (
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-secondary">
                <Spinner size={14} />
                Loading remote automations page...
              </div>
            )}

            {!loadingConfig && iframeUrl && (
              <iframe
                key={iframeUrl}
                src={iframeUrl}
                title="Remote automations"
                className="h-full min-h-[420px] w-full bg-white"
                referrerPolicy="no-referrer"
                sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              />
            )}

            {!loadingConfig && !iframeUrl && (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-text-secondary">
                Enter a remote automations URL above to load the page.
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface-1/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Note</p>
            <p className="mt-2 text-sm text-text-secondary">
              Some sites block embedding via iframe. If the page does not render, use Open External to continue in
              your browser.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
