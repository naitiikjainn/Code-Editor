import { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";

// Default context value to prevent crashes during HMR
const defaultContextValue = {
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  fetchWithAuth: () => Promise.resolve(new Response()),
  handleOAuthCallback: () => {},
  refreshAccessToken: () => Promise.resolve(null),
  needsUsername: false,
  setUsername: () => Promise.resolve()
};

const AuthContext = createContext(defaultContextValue);

// API base URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  
  // Use ref to track refresh promise and prevent race conditions
  const refreshPromiseRef = useRef(null);

  const isUsernameValid = useCallback((value) => {
    if (!value || typeof value !== "string") return false;
    return /^[a-zA-Z0-9_]{3,20}$/.test(value.trim());
  }, []);

  // Logout Function - memoized to prevent re-renders and dependency issues
  const logout = useCallback(async () => {
    const token = localStorage.getItem("codeplay_token");
    const refreshToken = localStorage.getItem("codeplay_refresh_token");
    
    // Clear state immediately
    setUser(null);
    setNeedsUsername(false);
    localStorage.removeItem("codeplay_user");
    localStorage.removeItem("codeplay_token");
    localStorage.removeItem("codeplay_refresh_token");
    
    // Notify server to invalidate tokens (fire and forget)
    if (token || refreshToken) {
      try {
        await fetch(`${API_URL}/api/oauth/logout`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token || ""}`
          },
          body: JSON.stringify({ refreshToken })
        });
      } catch (e) {
        // Ignore errors during logout
      }
    }
  }, []);

  // Refresh token function - uses promise ref to prevent concurrent refresh calls
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem("codeplay_refresh_token");
    if (!refreshToken) return null;
    
    // If a refresh is already in progress, return the existing promise
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    
    // Start the refresh and store the promise
    refreshPromiseRef.current = (async () => {
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
        // Clear the promise ref after completion
        refreshPromiseRef.current = null;
      }
    })();
    
    return refreshPromiseRef.current;
  }, [logout]);

  // Fetch with automatic token refresh
  const fetchWithAuth = useCallback(async (url, options = {}) => {
    let token = localStorage.getItem("codeplay_token");
    
    const makeRequest = async (authToken) => {
      const headers = {
        ...options.headers,
        "Authorization": `Bearer ${authToken}`
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
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setNeedsUsername(!isUsernameValid(userData?.username));
          } else if (response.status === 401) {
            // Token expired - logout immediately
            console.log("[Auth] Token expired, logging out...");
            logout();
          } else {
            // Clear invalid session
            logout();
          }
        } catch (error) {
          console.error("Auth check failed:", error);
          // Keep local user data if server is unreachable
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setNeedsUsername(!isUsernameValid(parsedUser?.username));
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, [isUsernameValid, logout]);

  // Periodic token expiry check (every 5 minutes) - auto logout when expired
  useEffect(() => {
    if (!user) return; // No user logged in

    const checkTokenExpiry = async () => {
      const token = localStorage.getItem("codeplay_token");
      if (!token) {
        logout();
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.status === 401) {
          // Token expired - auto logout without page refresh
          console.log("[Auth] Token expired during session, auto-logout triggered");
          logout();
          // Dispatch custom event for components to react
          window.dispatchEvent(new CustomEvent("auth:expired"));
        }
      } catch (error) {
        // Network error - don't logout, server might be down
        console.warn("[Auth] Token check failed (network):", error.message);
      }
    };

    // Check every 5 minutes
    const intervalId = setInterval(checkTokenExpiry, 5 * 60 * 1000);

    // Also check immediately when user state changes
    checkTokenExpiry();

    return () => clearInterval(intervalId);
  }, [user, logout]);

  // Login Function
  const login = useCallback((userData, token, refreshToken = null) => {
    setUser(userData);
    setNeedsUsername(!isUsernameValid(userData?.username));
    localStorage.setItem("codeplay_user", JSON.stringify(userData));
    localStorage.setItem("codeplay_token", token);
    if (refreshToken) {
      localStorage.setItem("codeplay_refresh_token", refreshToken);
    }
  }, [isUsernameValid]);

  // OAuth login helper - call after OAuth callback (returns a promise)
  const handleOAuthCallback = useCallback(async (token, refreshToken) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const userData = await res.json();
      if (!res.ok) throw new Error(userData.error || "Failed to fetch user data");
      login(userData, token, refreshToken);
      return userData;
    } catch (err) {
      console.error("OAuth callback error:", err);
      throw err;
    }
  }, [login]);

  const setUsername = async (username) => {
    const token = localStorage.getItem("codeplay_token");
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${API_URL}/api/auth/username`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ username })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to set username");

    setUser(data);
    setNeedsUsername(false);
    localStorage.setItem("codeplay_user", JSON.stringify(data));
    return data;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      fetchWithAuth,
      handleOAuthCallback,
      refreshAccessToken,
      needsUsername,
      setUsername
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  // Context will always have the default value at minimum
  return context;
};