import { resolve4, resolve6 } from "node:dns/promises";

const PRIVATE_RANGES = [
  { min: ip4("127.0.0.0"), max: ip4("127.255.255.255") },
  { min: ip4("10.0.0.0"), max: ip4("10.255.255.255") },
  { min: ip4("172.16.0.0"), max: ip4("172.31.255.255") },
  { min: ip4("192.168.0.0"), max: ip4("192.168.255.255") },
  { min: ip4("169.254.0.0"), max: ip4("169.254.255.255") },
  { min: ip4("0.0.0.0"), max: ip4("0.255.255.255") },
];

function ip4(str: string): number {
  const parts = str.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return NaN;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIP(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) {
    return true;
  }
  if (ip.startsWith("::ffff:")) {
    const embedded = ip.slice(7);
    if (embedded.includes(".")) return isPrivateIP(embedded);
    const groups = embedded.split(":");
    const lastTwo = groups.slice(-2);
    if (lastTwo.length === 2) {
      const hi = parseInt(lastTwo[0], 16);
      const lo = parseInt(lastTwo[1], 16);
      if (!isNaN(hi) && !isNaN(lo)) {
        const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateIP(ipv4);
      }
    }
    return false;
  }
  const num = ip4(ip);
  if (Number.isNaN(num)) return false;
  return PRIVATE_RANGES.some((r) => num >= r.min && num <= r.max);
}

export async function checkSSRF(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`无效的 URL: ${url}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`不支持的协议: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    throw new Error(`SSRF 拒绝: 不能访问本机地址 (${hostname})`);
  }
  try {
    for (const ip of await resolve4(hostname)) {
      if (isPrivateIP(ip)) throw new Error(`SSRF 拒绝: ${hostname} 解析到内网地址 (${ip})`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("SSRF 拒绝")) throw err;
  }
  try {
    for (const ip of await resolve6(hostname)) {
      if (isPrivateIP(ip)) throw new Error(`SSRF 拒绝: ${hostname} 解析到内网地址 (${ip})`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("SSRF 拒绝")) throw err;
  }
}
