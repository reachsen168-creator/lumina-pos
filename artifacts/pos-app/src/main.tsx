import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installFetchInterceptor } from "./lib/autoSave";

installFetchInterceptor();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

createRoot(document.getElementById("root")!).render(<App />);
