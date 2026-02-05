import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useAuth();
  const [status, setStatus] = useState("processing"); // processing, success, error
  const [message, setMessage] = useState("Processing login...");

  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refresh");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      const errorMessages = {
        no_code: "Authorization was cancelled or failed.",
        no_email: "Could not get email from provider. Please try again.",
        token_exchange_failed: "Failed to complete authentication. Please try again.",
        server_error: "Server error occurred. Please try again later.",
        access_denied: "Access was denied. Please try again."
      };
      setMessage(errorMessages[error] || `Authentication failed: ${error}`);
      return;
    }

    if (token && refreshToken) {
      setStatus("success");
      setMessage("Login successful! Redirecting...");
      
      // Save tokens, fetch user data, then redirect when ready
      const processOAuth = async () => {
        try {
          await handleOAuthCallback(token, refreshToken);
        } catch (err) {
          console.error("OAuth processing failed:", err);
          setStatus("error");
          setMessage("Login succeeded but failed to load user data. Please try again.");
          return;
        }
        
        // Small delay for visual feedback, then redirect
        setTimeout(() => {
          const returnTo = localStorage.getItem("codeplay_return_to") || "/";
          localStorage.removeItem("codeplay_return_to");
          navigate(returnTo, { replace: true });
        }, 500);
      };
      
      processOAuth();
    } else {
      setStatus("error");
      setMessage("Invalid callback. Missing authentication data.");
    }
  }, [searchParams, navigate, handleOAuthCallback]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: "rgba(30, 30, 30, 0.95)",
        borderRadius: "16px",
        padding: "40px 50px",
        textAlign: "center",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        minWidth: "350px"
      }}>
        {/* Icon */}
        <div style={{ marginBottom: "24px" }}>
          {status === "processing" && (
            <Loader2 
              size={48} 
              className="animate-spin" 
              style={{ color: "#8b5cf6" }} 
            />
          )}
          {status === "success" && (
            <CheckCircle 
              size={48} 
              style={{ color: "#4ade80" }} 
            />
          )}
          {status === "error" && (
            <XCircle 
              size={48} 
              style={{ color: "#ef5350" }} 
            />
          )}
        </div>

        {/* Title */}
        <h2 style={{ 
          color: "#fff", 
          fontSize: "20px", 
          fontWeight: "600",
          marginBottom: "12px"
        }}>
          {status === "processing" && "Signing you in..."}
          {status === "success" && "Welcome!"}
          {status === "error" && "Authentication Failed"}
        </h2>

        {/* Message */}
        <p style={{ 
          color: "#888", 
          fontSize: "14px",
          marginBottom: "24px" 
        }}>
          {message}
        </p>

        {/* Error Actions */}
        {status === "error" && (
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={() => navigate("/", { replace: true })}
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.15)"}
              onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.1)"}
            >
              Go Home
            </button>
            <button
              onClick={() => window.history.back()}
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)"
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Processing indicator */}
        {status === "processing" && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            gap: "8px",
            color: "#666",
            fontSize: "12px"
          }}>
            <AlertTriangle size={14} />
            <span>Please wait, do not close this window</span>
          </div>
        )}
      </div>

      {/* Animated background effect */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
