import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Workspace from "./components/Workspace";
import ProfilePage from "./components/ProfilePage";
import UserProfilePage from "./components/UserProfilePage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import OAuthCallback from "./components/OAuthCallback";
import { AuthProvider, useAuth } from "./context/AuthContext";
import UsernamePrompt from "./components/UsernamePrompt";

const AppShell = () => {
  const { needsUsername } = useAuth();

  return (
    <>
      <UsernamePrompt open={needsUsername} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/user/:username" element={<UserProfilePage />} />
          <Route path="/editor/:id" element={<Workspace />} />
          <Route path="/share/:id" element={<Workspace />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}