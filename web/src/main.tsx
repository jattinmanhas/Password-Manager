import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRouter } from "./app/router";
import { AuthProvider } from "./app/providers/AuthProvider";
import { Toaster } from "react-hot-toast";
import "./styles/index.css";

import { DialogProvider } from "./app/providers/DialogProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DialogProvider>
      <AuthProvider>
        <Toaster position="top-center" />
        <AppRouter />
      </AuthProvider>
    </DialogProvider>
  </StrictMode>
);
