import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "ghost";
    isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", isLoading, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                disabled={isLoading || props.disabled}
                className={cn(
                    "btn",
                    variant === "primary" ? "btn-primary" : "btn-ghost",
                    className
                )}
                {...props}
            >
                {isLoading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <svg
                            className="loading-spinner"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                style={{ opacity: 0.25 }}
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            ></circle>
                            <path
                                style={{ opacity: 0.75 }}
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                        Loading...
                    </span>
                ) : (
                    children
                )}
            </button>
        )
    }
)
Button.displayName = "Button"

export { Button }
