import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { Dialog } from "../../components/ui/Dialog";

interface DialogOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => Promise<void> | void;
}

interface DialogState extends DialogOptions {
    isOpen: boolean;
    type: "alert" | "confirm";
    isLoading: boolean;
    resolve?: (value: boolean) => void;
}

interface DialogContextType {
    alert: (options: DialogOptions) => Promise<boolean>;
    confirm: (options: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<DialogState>({
        isOpen: false,
        type: "alert",
        title: "",
        message: "",
        isLoading: false,
    });

    const show = useCallback((type: "alert" | "confirm", options: DialogOptions) => {
        return new Promise<boolean>((resolve) => {
            setState({
                ...options,
                isOpen: true,
                type,
                isLoading: false,
                resolve,
            });
        });
    }, []);

    const alert = useCallback((options: DialogOptions) => show("alert", options), [show]);
    const confirm = useCallback((options: DialogOptions) => show("confirm", options), [show]);

    const handleClose = useCallback(() => {
        if (state.resolve) state.resolve(false);
        setState((prev) => ({ ...prev, isOpen: false }));
    }, [state]);

    const handleConfirm = useCallback(async () => {
        if (state.onConfirm) {
            setState((prev) => ({ ...prev, isLoading: true }));
            try {
                await state.onConfirm();
                if (state.resolve) state.resolve(true);
                setState((prev) => ({ ...prev, isOpen: false, isLoading: false }));
            } catch (error) {
                setState((prev) => ({ ...prev, isLoading: false }));
                // Keep dialog open if confirm fails? For now, we close it unless error handling is complex
                // Actually, let's keep it simple for now and close it.
                if (state.resolve) state.resolve(false);
                setState((prev) => ({ ...prev, isOpen: false }));
            }
        } else {
            if (state.resolve) state.resolve(true);
            setState((prev) => ({ ...prev, isOpen: false }));
        }
    }, [state]);

    return (
        <DialogContext.Provider value={{ alert, confirm }}>
            {children}
            <Dialog
                isOpen={state.isOpen}
                onClose={handleClose}
                onConfirm={handleConfirm}
                title={state.title}
                description={state.message}
                confirmLabel={state.confirmLabel}
                cancelLabel={state.cancelLabel}
                type={state.type}
                isLoading={state.isLoading}
            />
        </DialogContext.Provider>
    );
}

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error("useDialog must be used within a DialogProvider");
    }
    return context;
};
