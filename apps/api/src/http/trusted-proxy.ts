const TRUSTED_PROXY_PRESETS = new Set(["linklocal", "loopback", "uniquelocal"]);

export function configureTrustedProxy(
  app: { set: (key: string, value: string) => unknown },
  preset: string
): void {
  if (!TRUSTED_PROXY_PRESETS.has(preset)) {
    throw new Error(`Unsupported trusted proxy preset: ${preset}`);
  }
  app.set("trust proxy", preset);
}

