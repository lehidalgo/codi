export interface InstallHint {
  /** Single-line install command to show in the terminal (e.g. "brew install gitleaks") */
  command: string;
  /** Optional URL for extended instructions */
  url?: string;
}

export type HookLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "kotlin"
  | "swift"
  | "csharp"
  | "cpp"
  | "php"
  | "ruby"
  | "dart"
  | "shell"
  | "global";

export type HookCategory = "format" | "lint" | "type-check" | "security" | "test" | "meta";

export type HookStage = "pre-commit" | "pre-push" | "commit-msg" | "manual";

export interface ShellEmission {
  command: string;
  passFiles: boolean;
  modifiesFiles: boolean;
  toolBinary: string;
}

export type PreCommitEmission =
  | {
      kind: "upstream";
      repo: string;
      rev: string;
      id: string;
      args?: string[];
      additionalDependencies?: string[];
      passFilenames?: boolean;
      alias?: string;
    }
  | {
      kind: "local";
      entry: string;
      language: "system" | "node" | "python";
      additionalDependencies?: string[];
      passFilenames?: boolean;
    };

export interface HookSpec {
  name: string;
  language: HookLanguage;
  category: HookCategory;
  files: string;
  exclude?: string;
  stages: HookStage[];
  required: boolean;
  shell: ShellEmission;
  preCommit: PreCommitEmission;
  installHint: InstallHint;
}
