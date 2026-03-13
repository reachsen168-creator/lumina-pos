import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installFetchInterceptor } from "./lib/autoSave";

// Install fetch interceptor before React renders
installFetchInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
