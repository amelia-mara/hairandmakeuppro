import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './hooks/useAuthStore';
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Dashboard from './pages/Dashboard';
import ScriptBreakdown from './pages/ScriptBreakdown';
import Characters from './pages/Characters';
import Budget from './pages/Budget';
import Settings from './pages/Settings';

function App() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f0f0f]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter basename="/desktop">
      <Routes>
        {!isAuthenticated ? (
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Route>
        ) : (
          <Route element={<AppLayout />}>
            <Route path="/" element={<Projects />} />
            <Route path="/breakdown" element={<ScriptBreakdown />} />
            <Route path="/breakdown/:projectId" element={<ScriptBreakdown />} />
            <Route path="/project/:id" element={<Dashboard />} />
            <Route path="/project/:id/breakdown" element={<ScriptBreakdown />} />
            <Route path="/project/:id/characters" element={<Characters />} />
            <Route path="/project/:id/budget" element={<Budget />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
