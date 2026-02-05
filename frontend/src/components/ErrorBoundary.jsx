import React from "react";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env?.DEV;

      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "300px", padding: "48px 24px", textAlign: "center",
          background: "rgba(239, 68, 68, 0.03)", borderRadius: "16px",
          border: "1px solid rgba(239, 68, 68, 0.1)", margin: "16px"
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "16px",
            background: "rgba(239, 68, 68, 0.1)", display: "flex",
            alignItems: "center", justifyContent: "center", marginBottom: "20px"
          }}>
            <ShieldAlert size={28} color="#ef4444" />
          </div>

          <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#fafafa", marginBottom: "8px" }}>
            Something went wrong
          </h3>
          <p style={{ fontSize: "14px", color: "#a1a1aa", marginBottom: "24px", maxWidth: "400px", lineHeight: "1.6" }}>
            An unexpected error occurred. You can try again or go back to the homepage.
          </p>

          {isDev && this.state.error && (
            <pre style={{
              fontSize: "11px", color: "#fca5a5", background: "rgba(0,0,0,0.3)",
              padding: "12px 16px", borderRadius: "8px", overflow: "auto",
              maxHeight: "120px", maxWidth: "500px", width: "100%",
              textAlign: "left", marginBottom: "20px", border: "1px solid rgba(239,68,68,0.15)"
            }}>
              {this.state.error.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          )}

          <div style={{ display: "flex", gap: "12px" }}>
            <button 
              onClick={this.handleRetry}
              style={{
                padding: "10px 20px", borderRadius: "10px", border: "none",
                background: "#fafafa", color: "#050505", fontWeight: "600",
                fontSize: "13px", cursor: "pointer", display: "flex",
                alignItems: "center", gap: "8px", transition: "opacity 0.2s"
              }}
            >
              <RefreshCw size={14} /> Try Again
            </button>
            <button
              onClick={() => window.location.href = "/"}
              style={{
                padding: "10px 20px", borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "#a1a1aa", fontWeight: "500",
                fontSize: "13px", cursor: "pointer", display: "flex",
                alignItems: "center", gap: "8px", transition: "all 0.2s"
              }}
            >
              <Home size={14} /> Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
