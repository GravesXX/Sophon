// OpenClaw plugin API types (minimal subset we need)
export interface PluginAPI {
  registerTool(tool: ToolDefinition): void;
  registerCommand(command: CommandDefinition): void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterDef>;
  run: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ParameterDef {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface CommandDefinition {
  name: string;
  description: string;
  run: (args: string) => Promise<string>;
}

export interface ToolResult {
  content: string;
  error?: string;
}
