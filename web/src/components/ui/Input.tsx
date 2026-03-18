import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean | string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, ...props }, ref) => {
        return (
            <div style={{ width: "100%" }}>
                <input
                    type={type}
                    className={cn("input", error && "error", className)}
                    ref={ref}
                    {...props}
                />
                {typeof error === "string" && (
                    <p style={{ color: "var(--color-red)", fontSize: "0.75rem", marginTop: "0.25rem", marginBottom: 0 }}>
                        {error}
                    </p>
                )}
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }
