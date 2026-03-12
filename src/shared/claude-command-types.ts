export interface ClaudeCliCommand {
  name: string;
  aliases: string[];
  usage: string;
  description: string;
  commandPath: string[];
  command: string;
  requiresArguments: boolean;
  children: ClaudeCliCommand[];
}

export interface ClaudeCommandCatalog {
  generatedAt: number;
  commands: ClaudeCliCommand[];
}
