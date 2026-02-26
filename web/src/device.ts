export function guessDeviceName(): string {
  const nav = navigator as Navigator & {
    userAgentData?: {
      brands?: Array<{ brand: string }>;
      platform?: string;
    };
  };
  const uaData = nav.userAgentData;
  if (uaData && uaData.brands && uaData.platform) {
    const brand = uaData.brands.find((entry) => entry.brand !== "Not A;Brand")?.brand ?? "Browser";
    return `${brand} on ${uaData.platform}`;
  }

  const ua = navigator.userAgent;
  const browser = detectBrowser(ua);
  const os = detectOS(ua, navigator.platform);
  return `${browser} on ${os}`;
}

function detectBrowser(ua: string): string {
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("Firefox/")) return "Firefox";
  return "Browser";
}

function detectOS(ua: string, platform: string): string {
  if (ua.includes("Mac OS X") || platform.includes("Mac")) return "macOS";
  if (ua.includes("Windows") || platform.includes("Win")) return "Windows";
  if (ua.includes("Linux") || platform.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Unknown OS";
}
