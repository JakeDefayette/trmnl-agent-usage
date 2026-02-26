import * as logger from "../logger.js";

function decodeHex(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

function isHexEncoded(value: string): boolean {
  return /^[0-9a-f]+$/i.test(value) && value.length % 2 === 0 && value.length > 40;
}

export async function readKeychainPassword(service: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["security", "find-generic-password", "-s", service, "-w"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      return null;
    }

    const stdout = (await new Response(proc.stdout).text()).trim();

    // macOS keychain outputs hex when the item was stored as data (not a string)
    if (isHexEncoded(stdout)) {
      let decoded = decodeHex(stdout);
      // Strip any leading control characters (keychain data prefix byte)
      decoded = decoded.replace(/^[\x00-\x1f]+/, "");
      // Re-add opening brace if it was stripped and the value looks like JSON
      if (!decoded.startsWith("{") && decoded.startsWith('"')) {
        decoded = "{" + decoded;
      }
      return decoded;
    }

    return stdout;
  } catch (err) {
    logger.warn(`Keychain read failed for "${service}": ${err}`);
    return null;
  }
}
