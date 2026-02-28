import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell, Header } from './components/ui';
import { Navbar } from './components/nav/Navbar';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Report from './pages/Report';
import Profile from './pages/Profile';

// Lazy load admin dashboard — separate chunk, only loaded when /admin is accessed
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin route — outside AppShell (has its own dark layout) */}
          <Route
            path="/admin"
            element={
              <Suspense fallback={<div style={{ background: '#0D1117', minHeight: '100vh' }} />}>
                <AdminDashboard />
              </Suspense>
            }
          />
          {/* Main app routes */}
          <Route
            path="*"
            element={
              <AppShell>
                <Header>
                  <Navbar />
                </Header>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/report" element={<Report />} />
                  <Route path="/profile" element={<Profile />} />
                </Routes>
              </AppShell>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
