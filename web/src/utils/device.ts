export function guessDeviceName(): string {
    const nav = window.navigator as any;
    const userAgent = nav.userAgent || "";

    let os = "Unknown OS";
    if (userAgent.includes("Windows NT 10.0")) os = "Windows 10/11";
    else if (userAgent.includes("Mac OS X")) os = "macOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

    let browser = "Unknown Browser";
    if (userAgent.includes("Firefox/")) browser = "Firefox";
    else if (userAgent.includes("Edg/")) browser = "Edge";
    else if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/")) browser = "Chrome";
    else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) browser = "Safari";

    return `${os} - ${browser}`;
}
