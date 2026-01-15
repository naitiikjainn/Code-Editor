import { createContext, useState, useEffect, useContext, useCallback } from "react";

const AuthContext = createContext();

// API base URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh token function
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem("codeplay_refresh_token");
    if (!refreshToken || isRefreshing) return null;
    
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/api/oauth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      
      if (!response.ok) {
        // Refresh token invalid, logout
        logout();
        return null;
      }
      
      const data = await response.json();
      
      // Update tokens
      localStorage.setItem("codeplay_token", data.token);
      localStorage.setItem("codeplay_refresh_token", data.refreshToken);
      localStorage.setItem("codeplay_user", JSON.stringify(data.user));
      setUser(data.user);
      
      return data.token;
    } catch (error) {
      console.error("Token refresh failed:", error);
      logout();
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Fetch with automatic token refresh
  const fetchWithAuth = useCallback(async (url, options = {}) => {
    let token = localStorage.getItem("codeplay_token");
    
    const makeRequest = async (authToken) => {
      const headers = {
        ...options.headers,
        "x-auth-token": authToken
      };
      return fetch(url, { ...options, headers });
    };
    
    let response = await makeRequest(token);
    
    // If 401 with TOKEN_EXPIRED, try refresh
    if (response.status === 401) {
      const data = await response.clone().json().catch(() => ({}));
      if (data.code === "TOKEN_EXPIRED") {
        const newToken = await refreshAccessToken();
        if (newToken) {
          response = await makeRequest(newToken);
        }
      }
    }
    
    return response;
  }, [refreshAccessToken]);

  // Check if user is already logged in (on page refresh)
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = localStorage.getItem("codeplay_user");
      const token = localStorage.getItem("codeplay_token");
      
      if (storedUser && token) {
        // Verify token is still valid
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { "x-auth-token": token }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else if (response.status === 401) {
            // Try refresh
            await refreshAccessToken();
          } else {
            // Clear invalid session
            logout();
          }
        } catch (error) {
          console.error("Auth check failed:", error);
          // Keep local user data if server is unreachable
          setUser(JSON.parse(storedUser));
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  // Login Function
  const login = (userData, token, refreshToken = null) => {
    setUser(userData);
    localStorage.setItem("codeplay_user", JSON.stringify(userData));
    localStorage.setItem("codeplay_token", token);
    if (refreshToken) {
      localStorage.setItem("codeplay_refresh_token", refreshToken);
    }
  };

  // Logout Function
  const logout = async () => {
    const token = localStorage.getItem("codeplay_token");
    const refreshToken = localStorage.getItem("codeplay_refresh_token");
    
    // Notify server to invalidate tokens
    if (token || refreshToken) {
      try {
        await fetch(`${API_URL}/api/oauth/logout`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-auth-token": token || ""
          },
          body: JSON.stringify({ refreshToken })
        });
      } catch (e) {
        // Ignore errors during logout
      }
    }
    
    setUser(null);
    localStorage.removeItem("codeplay_user");
    localStorage.removeItem("codeplay_token");
    localStorage.removeItem("codeplay_refresh_token");
  };

  // OAuth login helper - call after OAuth callback
  const handleOAuthCallback = (token, refreshToken) => {
    // Fetch user data with the token
    fetch(`${API_URL}/api/auth/me`, {
      headers: { "x-auth-token": token }
    })
      .then(res => res.json())
      .then(userData => {
        login(userData, token, refreshToken);
      })
      .catch(err => {
        console.error("OAuth callback error:", err);
      });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      fetchWithAuth,
      handleOAuthCallback,
      refreshAccessToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);