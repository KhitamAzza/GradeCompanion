import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Login from './login';
import Layout from './Layout';

import Home from './pages/Home';
import Students from './pages/Students';
import Scores from './pages/Scores';
import Exams from './pages/Exams';
import Correction from './pages/Correction';
import Settings from './pages/Settings';

function Shell() {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/"           element={<Home />} />
        <Route path="/students"   element={<Students />} />
        <Route path="/scores"     element={<Scores />} />
        <Route path="/exams"      element={<Exams />} />
        <Route path="/correction" element={<Correction />} />
        <Route path="/settings"   element={<Settings />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AuthProvider>
  );
}