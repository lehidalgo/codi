import type { LogLevel, OutputMode } from "./types.js";
import type { Logger as LoggerInterface } from "#src/types/logger.js";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

interface LoggerOptions {
  level: LogLevel;
  mode: OutputMode;
  noColor: boolean;
}

/**
 * Concrete logger. `utils/` and `adapters/` import only the
 * {@link LoggerInterface} from `src/types/logger.ts` — never this class.
 * The composition root (CLI entry points, the generator pipeline) holds
 * the singleton via `Logger.getInstance()` and threads it through DI.
 */
export class Logger implements LoggerInterface {
  private static instance: Logger | null = null;

  private level: LogLevel;
  private mode: OutputMode;
  readonly noColor: boolean;

  constructor(options: LoggerOptions) {
    this.level = options.level;
    this.mode = options.mode;
    this.noColor = options.noColor;
  }

  static init(options: LoggerOptions): Logger {
    Logger.instance = new Logger(options);
    return Logger.instance;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger({
        level: "info",
        mode: "human",
        noColor: false,
      });
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setMode(mode: OutputMode): void {
    this.mode = mode;
  }

  debug(message: string, ...args: unknown[]): void {
    this.log("debug", message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log("info", message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log("warn", message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log("error", message, ...args);
  }

  fatal(message: string, ...args: unknown[]): void {
    this.log("fatal", message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (this.mode === "json") return;
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) return;

    const prefix = this.formatPrefix(level);
    const suffix =
      args.length > 0
        ? " " +
          args
            .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
            .join(" ")
        : "";
    process.stderr.write(`${prefix} ${message}${suffix}\n`);
  }

  private formatPrefix(level: LogLevel): string {
    const labels: Record<LogLevel, string> = {
      debug: "DBG",
      info: "INF",
      warn: "WRN",
      error: "ERR",
      fatal: "FTL",
    };
    return `[${labels[level]}]`;
  }
}
