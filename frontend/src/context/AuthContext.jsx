import { createContext, useState, useEffect, useContext } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // <--- Add loading state

  // Check if user is already logged in (on page refresh)
  useEffect(() => {
    const storedUser = localStorage.getItem("codeplay_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false); // <--- Set loading to false after check
  }, []);

  // Login Function
  const login = (userData, token) => {
    // Save to State
    setUser(userData);
    // Save to LocalStorage (so it persists on refresh)
    localStorage.setItem("codeplay_user", JSON.stringify(userData));
    localStorage.setItem("codeplay_token", token);
  };

  // Logout Function
  const logout = () => {
    setUser(null);
    localStorage.removeItem("codeplay_user");
    localStorage.removeItem("codeplay_token");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);