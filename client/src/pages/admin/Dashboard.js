import React, { useState, useEffect } from 'react';
import api from '../../api';
import './Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState({ total: 0, totalSongs: 0, duplicates: 0, byDepartment: [], byCategory: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/submissions/stats');
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of song submissions</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Submissions</span>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">🎵</div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalSongs || stats.total}</span>
            <span className="stat-label">Total Songs</span>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <span className="stat-value">{stats.duplicates}</span>
            <span className="stat-label">Duplicates Found</span>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <span className="stat-value">{stats.byDepartment?.length || 0}</span>
            <span className="stat-label">Departments</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card card">
          <h3>By Department</h3>
          <div className="chart-list">
            {stats.byDepartment?.map((item) => (
              <div key={item._id} className="chart-item">
                <span className="chart-label">{item._id}</span>
                <div className="chart-bar-container">
                  <div 
                    className="chart-bar" 
                    style={{ width: `${(item.count / stats.total) * 100}%` }}
                  />
                </div>
                <span className="chart-value">{item.count}</span>
              </div>
            ))}
            {!stats.byDepartment?.length && <p className="empty">No data yet</p>}
          </div>
        </div>

        <div className="chart-card card">
          <h3>By Shift</h3>
          <div className="chart-list">
            {stats.byShift?.map((item) => (
              <div key={item._id} className="chart-item">
                <span className="chart-label">{item._id}</span>
                <div className="chart-bar-container">
                  <div 
                    className="chart-bar secondary" 
                    style={{ width: `${(item.count / stats.total) * 100}%` }}
                  />
                </div>
                <span className="chart-value">{item.count}</span>
              </div>
            ))}
            {!stats.byShift?.length && <p className="empty">No data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
