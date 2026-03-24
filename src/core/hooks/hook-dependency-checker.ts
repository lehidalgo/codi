import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { HookEntry } from './hook-registry.js';

const execFileAsync = promisify(execFile);

export interface DependencyCheck {
  name: string;
  available: boolean;
  installHint: string;
}

const INSTALL_HINTS: Record<string, string> = {
  'eslint': 'npm install -D eslint',
  'prettier': 'npm install -D prettier',
  'tsc': 'npm install -D typescript',
  'ruff': 'pip install ruff',
  'pyright': 'pip install pyright',
  'golangci-lint': 'go install github.com/golangci-lint/golangci-lint/cmd/golangci-lint@latest',
  'gofmt': '(included with Go)',
  'cargo': '(included with Rust)',
  'cargo-clippy': 'rustup component add clippy',
  'cargo-fmt': 'rustup component add rustfmt',
  'google-java-format': 'brew install google-java-format (or download from GitHub)',
  'checkstyle': 'brew install checkstyle (or download jar)',
  'ktfmt': 'brew install ktfmt',
  'detekt': 'brew install detekt',
  'swiftformat': 'brew install swiftformat',
  'swiftlint': 'brew install swiftlint',
  'dotnet': 'Install .NET SDK from https://dot.net',
  'clang-format': 'brew install clang-format (or apt install clang-format)',
  'clang-tidy': 'brew install llvm (or apt install clang-tidy)',
  'php-cs-fixer': 'composer global require friendsofphp/php-cs-fixer',
  'phpstan': 'composer global require phpstan/phpstan',
  'rubocop': 'gem install rubocop',
  'dart': 'Install Dart SDK from https://dart.dev',
};

function extractToolName(command: string): string {
  const firstWord = command.split(/\s+/)[0] ?? command;
  return firstWord.replace(/^npx\s+/, '');
}

async function isToolAvailable(tool: string): Promise<boolean> {
  try {
    await execFileAsync('which', [tool]);
    return true;
  } catch {
    return false;
  }
}

export async function checkHookDependencies(hooks: HookEntry[]): Promise<DependencyCheck[]> {
  const seen = new Set<string>();
  const checks: DependencyCheck[] = [];

  for (const hook of hooks) {
    const tool = extractToolName(hook.command);
    if (seen.has(tool) || tool === 'npx') continue;
    seen.add(tool);

    const available = await isToolAvailable(tool);
    if (!available) {
      checks.push({
        name: tool,
        available: false,
        installHint: INSTALL_HINTS[tool] ?? `Install ${tool}`,
      });
    }
  }

  return checks;
}
