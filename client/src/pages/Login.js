import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import './Login.css';

function Login({ setIsAuth }) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    dmartCode: '',
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const { data } = await api.post(endpoint, form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('dmartCode', data.dmartCode);
      setIsAuth(true);
      toast.success(isRegister ? 'Store registered!' : 'Welcome back!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card card">
        <div className="login-header">
          <h1>🎵 DMart Umang</h1>
          <p>Song Management System</p>
        </div>
        
        <div className="login-tabs">
          <button 
            className={`tab ${!isRegister ? 'active' : ''}`} 
            onClick={() => setIsRegister(false)}
          >
            Login
          </button>
          <button 
            className={`tab ${isRegister ? 'active' : ''}`} 
            onClick={() => setIsRegister(true)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">DMart Code *</label>
            <input
              type="text"
              name="dmartCode"
              className="input"
              value={form.dmartCode}
              onChange={handleChange}
              placeholder="e.g., 3938"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Admin Email *</label>
            <input
              type="email"
              name="username"
              className="input"
              value={form.username}
              onChange={handleChange}
              placeholder="admin@dmart.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Password *</label>
            <input
              type="password"
              name="password"
              className="input"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Please wait...' : (isRegister ? 'Register' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
