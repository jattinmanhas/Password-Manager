import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRouter } from "./app/router";
import { AuthProvider } from "./app/providers/AuthProvider";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </StrictMode>
);
