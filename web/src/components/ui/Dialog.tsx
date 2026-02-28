import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { X } from "lucide-react";

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    type?: "alert" | "confirm";
    isLoading?: boolean;
}

export function Dialog({
    isOpen,
    onClose,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    type = "alert",
    isLoading = false,
}: DialogProps) {
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted || !isOpen) return null;

    return createPortal(
        <div className="dialog-overlay">
            <div className="dialog-container" role="dialog" aria-modal="true">
                <button className="dialog-close" onClick={onClose} aria-label="Close dialog">
                    <X size={20} />
                </button>
                
                <div className="dialog-content">
                    <h3 className="dialog-title">{title}</h3>
                    <p className="dialog-description">{description}</p>
                </div>

                <div className="dialog-footer">
                    {type === "confirm" && (
                        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                            {cancelLabel}
                        </Button>
                    )}
                    <Button 
                        onClick={() => {
                            if (onConfirm) {
                                onConfirm();
                            } else {
                                onClose();
                            }
                        }}
                        isLoading={isLoading}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
