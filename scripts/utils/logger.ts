export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.context}]: ${message}`;
  }

  info(message: string): void {
    console.log(this.formatMessage("INFO", message));
  }

  warn(message: string): void {
    console.warn(this.formatMessage("WARN", message));
  }

  error(message: string): void {
    console.error(this.formatMessage("ERROR", message));
  }

  debug(message: string): void {
    if (process.env.DEBUG === "true") {
      console.debug(this.formatMessage("DEBUG", message));
    }
  }
}
