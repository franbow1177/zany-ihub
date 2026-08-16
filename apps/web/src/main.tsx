import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@workspace/ui/globals.css"
import "@/styles/editor.css"
import { App } from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { AppZeroProvider } from "@/components/app-zero-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AppZeroProvider>
        <App />
      </AppZeroProvider>
    </ThemeProvider>
  </StrictMode>
)
