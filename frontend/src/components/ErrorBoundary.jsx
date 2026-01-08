import React from "react";
import { ShieldAlert } from "lucide-react";

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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "24px", color: "#ef4444", background: "rgba(239, 68, 68, 0.1)", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)", fontFamily: "monospace" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
             <ShieldAlert size={24} />
             <h3 style={{ fontSize: "16px", fontWeight: "bold" }}>Something went wrong.</h3>
          </div>
          <p style={{ fontSize: "12px", marginBottom: "12px" }}>{this.state.error && this.state.error.toString()}</p>
          <pre style={{ fontSize: "10px", overflow: "auto", maxHeight: "200px", color: "#fca5a5" }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: "16px", padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
          >
              Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
