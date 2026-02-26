function timestamp(): string {
  return new Date().toISOString();
}

export function info(msg: string): void {
  console.error(`[${timestamp()}] INFO  ${msg}`);
}

export function warn(msg: string): void {
  console.error(`[${timestamp()}] WARN  ${msg}`);
}

export function error(msg: string): void {
  console.error(`[${timestamp()}] ERROR ${msg}`);
}
