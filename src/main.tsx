import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./style.css";
import "./redesign.css";
import "./console.css";
import "./expedition.css";
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { retry: false },
    queries: { refetchOnWindowFocus: true },
  },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

import "./mission.css";
