import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./utils/leafletSetup";
import { AuthProvider } from "./context/AuthContext";
import axios from "axios";

// Set base URL for all axios requests
axios.defaults.baseURL = "http://localhost:5000";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
