import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

let loginProcess: ChildProcess | null = null;

/** Resolve the full path to the claude binary so it works inside Electron */
function claudeBin(): string {
  return process.env.CLAUDE_BIN || 'claude';
}

/** Shared env: inherit PATH additions from shell profile */
function claudeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TERM: 'dumb',
    // Ensure common install locations are on PATH inside Electron
    PATH: [
      process.env.PATH,
      '/usr/local/bin',
      '/opt/homebrew/bin',
      `${process.env.HOME}/.local/bin`,
      `${process.env.HOME}/.npm-global/bin`,
    ]
      .filter(Boolean)
      .join(':'),
  };
}

export async function isCliInstalled(): Promise<boolean> {
  try {
    await execFileAsync(claudeBin(), ['--version'], {
      timeout: 5000,
      env: claudeEnv(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function getAuthStatus(): Promise<{
  installed: boolean;
  authenticated: boolean;
  account?: string;
}> {
  const installed = await isCliInstalled();
  if (!installed) {
    return { installed: false, authenticated: false };
  }

  try {
    // claude auth status outputs JSON — it exits 1 when not logged in, so
    // we need to capture stdout regardless of exit code.
    const { stdout } = await execFileAsync(claudeBin(), ['auth', 'status'], {
      timeout: 10000,
      env: claudeEnv(),
    });
    return parseAuthOutput(stdout);
  } catch (err: any) {
    // Even on exit code 1, stdout may contain valid JSON
    if (err.stdout) {
      return parseAuthOutput(err.stdout);
    }
    return { installed: true, authenticated: false };
  }
}

function parseAuthOutput(stdout: string): {
  installed: boolean;
  authenticated: boolean;
  account?: string;
} {
  const text = stdout.trim();

  // Try JSON parse first (newer CLI versions output JSON)
  try {
    const data = JSON.parse(text.split('\n')[0]);
    if (typeof data.loggedIn === 'boolean') {
      return {
        installed: true,
        authenticated: data.loggedIn,
        account: data.email || data.account || (data.loggedIn ? 'Logged in' : undefined),
      };
    }
  } catch {
    // not JSON, fall through to text parsing
  }

  const lower = text.toLowerCase();
  const notLoggedIn =
    lower.includes('not logged in') ||
    lower.includes('not authenticated') ||
    lower.includes('no active') ||
    lower.includes('"loggedin": false') ||
    lower.includes('"loggedin":false');

  return {
    installed: true,
    authenticated: !notLoggedIn,
    account: !notLoggedIn ? text : undefined,
  };
}

export async function loginWithCli(): Promise<{ success: boolean; error?: string }> {
  if (loginProcess) {
    return { success: false, error: 'Login already in progress' };
  }

  return new Promise((resolve) => {
    loginProcess = spawn(claudeBin(), ['auth', 'login'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: claudeEnv(),
    });

    let stderr = '';

    loginProcess.stdout?.on('data', () => {});
    loginProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    loginProcess.on('close', (code) => {
      loginProcess = null;
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: stderr || `Login exited with code ${code}`,
        });
      }
    });

    loginProcess.on('error', (err) => {
      loginProcess = null;
      resolve({ success: false, error: err.message });
    });
  });
}

export function logoutCli(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(claudeBin(), ['auth', 'logout'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: claudeEnv(),
    });

    let stderr = '';
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Logout exited with code ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

export function cancelLogin(): void {
  if (loginProcess) {
    loginProcess.kill();
    loginProcess = null;
  }
}

export function isLoginInProgress(): boolean {
  return loginProcess !== null;
}
