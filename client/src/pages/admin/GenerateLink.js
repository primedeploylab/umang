import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api';
import './GenerateLink.css';

function GenerateLink() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const { data } = await api.get('/links');
      setLinks(data);
    } catch (error) {
      toast.error('Failed to fetch links');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/links/generate');
      setLinks([{ linkId: data.linkId, isActive: true, createdAt: new Date() }, ...links]);
      toast.success('Link generated!');
    } catch (error) {
      toast.error('Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeactivate = async (linkId) => {
    try {
      await api.put(`/links/${linkId}/deactivate`);
      setLinks(links.map(l => l.linkId === linkId ? { ...l, isActive: false } : l));
      toast.success('Link deactivated');
    } catch (error) {
      toast.error('Failed to deactivate');
    }
  };

  const copyToClipboard = (linkId) => {
    const url = `${window.location.origin}/submit/${linkId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  return (
    <div className="generate-link-page">
      <div className="page-header">
        <h1>Generate Submission Link</h1>
        <p>Create unique links for participants to submit songs</p>
      </div>

      <div className="generate-section card">
        <div className="generate-content">
          <div className="generate-info">
            <h3>🔗 Create New Link</h3>
            <p>Generate a unique URL that participants can use to submit their songs.</p>
          </div>
          <button 
            className="btn btn-primary btn-lg" 
            onClick={handleGenerate} 
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Link'}
          </button>
        </div>
      </div>

      <div className="links-section card">
        <h3>Generated Links</h3>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="links-list">
            {links.map((link) => (
              <div key={link.linkId} className={`link-item ${!link.isActive ? 'inactive' : ''}`}>
                <div className="link-info">
                  <code className="link-url">{window.location.origin}/submit/{link.linkId}</code>
                  <span className="link-date">
                    Created: {new Date(link.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="link-bottom">
                  <div className="link-status">
                    <span className={`badge ${link.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {link.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="link-actions">
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => copyToClipboard(link.linkId)}
                    >
                      📋 Copy
                    </button>
                    {link.isActive && (
                      <button 
                        className="btn btn-danger btn-sm" 
                        onClick={() => handleDeactivate(link.linkId)}
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!links.length && <p className="empty">No links generated yet</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default GenerateLink;
