import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRouter } from "./app/router";
import { AuthProvider } from "./app/providers/AuthProvider";
import { Toaster } from "react-hot-toast";
import "./styles/index.css";

import { DialogProvider } from "./app/providers/DialogProvider";
import { VaultProvider } from "./app/providers/VaultProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DialogProvider>
      <AuthProvider>
        <VaultProvider>
          <Toaster position="top-center" />
          <AppRouter />
        </VaultProvider>
      </AuthProvider>
    </DialogProvider>
  </StrictMode>
);
