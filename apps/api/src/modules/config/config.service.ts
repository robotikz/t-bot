export class ConfigService {
  private readonly env = process.env;

  get(key: string, defaultValue?: string): string {
    const v = this.env[key];
    return v === undefined || v === '' ? (defaultValue as string) : v;
  }
}
