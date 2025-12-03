import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminLayout from './components/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Categories from './pages/admin/Categories';
import Submissions from './pages/admin/Submissions';
import GenerateLink from './pages/admin/GenerateLink';
import SubmitForm from './pages/SubmitForm';
import api from './api';

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/verify')
        .then(() => setIsAuth(true))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuth ? <Navigate to="/admin" /> : <Login setIsAuth={setIsAuth} />} />
      <Route path="/submit/:linkId" element={<SubmitForm />} />
      <Route path="/admin" element={isAuth ? <AdminLayout setIsAuth={setIsAuth} /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="categories" element={<Categories />} />
        <Route path="submissions" element={<Submissions />} />
        <Route path="generate-link" element={<GenerateLink />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
