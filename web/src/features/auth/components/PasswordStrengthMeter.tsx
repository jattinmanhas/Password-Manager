import { useMemo } from "react";

interface PasswordStrengthMeterProps {
    password?: string;
}

export function PasswordStrengthMeter({ password = "" }: PasswordStrengthMeterProps) {
    const strength = useMemo(() => {
        if (!password) return 0;

        const hasLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLowerAndNum = /[a-z]/.test(password) && /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        let score = 0;
        if (hasLength) score += 1;
        if (hasUpper) score += 1;
        if (hasLowerAndNum) score += 1;
        if (hasSpecial) score += 1;

        return score;
    }, [password]);

    const getStrengthConfig = () => {
        switch (strength) {
            case 0:
                return { label: "Very Weak", colorClass: "bg-red", textClass: "text-red", widthClass: "w-10" };
            case 1:
                return { label: "Weak", colorClass: "bg-red", textClass: "text-red", widthClass: "w-25" };
            case 2:
                return { label: "Fair", colorClass: "bg-amber", textClass: "text-amber", widthClass: "w-50" };
            case 3:
                return { label: "Good", colorClass: "bg-blue", textClass: "text-blue", widthClass: "w-75" };
            case 4:
                return { label: "Strong", colorClass: "bg-green", textClass: "text-green", widthClass: "w-100" };
            default:
                return { label: "Very Weak", colorClass: "bg-red", textClass: "text-red", widthClass: "w-10" };
        }
    };

    const config = getStrengthConfig();

    if (!password) return null;

    return (
        <div className="strength-meter">
            <div className="strength-header">
                <span style={{ color: "var(--color-text-subtle)" }}>Password strength</span>
                <span className={config.textClass} style={{ transition: "color 0.3s ease" }}>{config.label}</span>
            </div>
            <div className="strength-bar-bg">
                <div className={`strength-bar-fill ${config.colorClass} ${config.widthClass}`} />
            </div>
            <ul className="strength-reqs">
                <li className={password.length >= 8 ? "text-green" : ""}>• 8+ characters</li>
                <li className={/[A-Z]/.test(password) ? "text-green" : ""}>• Uppercase letter</li>
                <li className={/[a-z]/.test(password) && /[0-9]/.test(password) ? "text-green" : ""}>• Letters & Numbers</li>
                <li className={/[^A-Za-z0-9]/.test(password) ? "text-green" : ""}>• Special character</li>
            </ul>
        </div>
    );
}
