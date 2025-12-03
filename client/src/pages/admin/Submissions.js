import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api';
import './Submissions.css';

function Submissions() {
  const [submissions, setSubmissions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ department: '', shift: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editModal, setEditModal] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subRes, catRes] = await Promise.all([
        api.get('/submissions'),
        api.get('/categories')
      ]);
      setSubmissions(subRes.data);
      setCategories(catRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.department) params.append('department', filters.department);
      if (filters.shift) params.append('shift', filters.shift);
      if (filters.search) params.append('search', filters.search);
      const { data } = await api.get(`/submissions?${params}`);
      setSubmissions(data);
    } catch (error) {
      toast.error('Failed to filter');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this submission and all its songs?')) return;
    try {
      await api.delete(`/submissions/${id}`);
      setSubmissions(submissions.filter(s => s._id !== id));
      setExpandedId(null);
      toast.success('Deleted successfully');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const response = await api.get(`/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `submissions.${type === 'excel' ? 'csv' : type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Exported as ${type.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };


  const handleEdit = (sub) => {
    const songs = getSongs(sub);
    setEditModal({
      _id: sub._id,
      department: sub.department,
      shift: sub.shift,
      gender: sub.gender,
      members: sub.members || [],
      songs: songs
    });
  };

  const handleSaveEdit = async () => {
    try {
      const formData = new FormData();
      formData.append('department', editModal.department);
      formData.append('shift', editModal.shift);
      formData.append('gender', editModal.gender);
      formData.append('members', JSON.stringify(editModal.members));
      formData.append('songs', JSON.stringify(editModal.songs));
      
      await api.put(`/submissions/edit/${editModal._id}`, formData);
      toast.success('Updated successfully');
      setEditModal(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const departments = categories.filter(c => c.type === 'department');
  const shifts = categories.filter(c => c.type === 'shift');

  const getSongs = (sub) => {
    if (sub.songs && sub.songs.length > 0) return sub.songs;
    if (sub.youtubeLink || sub.songName) {
      return [{ songName: sub.songName, youtubeLink: sub.youtubeLink }];
    }
    return [];
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="submissions-page">
      <div className="page-header">
        <h1>Submissions</h1>
        <p>View and manage all song submissions ({submissions.length} total)</p>
      </div>

      <div className="toolbar card">
        <div className="filters">
          <select className="select" value={filters.department} 
            onChange={(e) => setFilters({...filters, department: e.target.value})}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
          </select>
          <select className="select" value={filters.shift} 
            onChange={(e) => setFilters({...filters, shift: e.target.value})}>
            <option value="">All Shifts</option>
            {shifts.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
          </select>
          <input type="text" className="input" placeholder="Search..." value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})} />
          <button className="btn btn-primary" onClick={handleFilter}>Filter</button>
        </div>
        <div className="export-btns">
          <button className="btn btn-outline" onClick={() => handleExport('pdf')} disabled={exporting}>📄 PDF</button>
          <button className="btn btn-outline" onClick={() => handleExport('excel')} disabled={exporting}>📊 Excel</button>
        </div>
      </div>

      {loading ? (
        <div className="loading card">Loading...</div>
      ) : (
        <div className="submissions-list">
          {submissions.map((sub, idx) => {
            const songs = getSongs(sub);
            const isExpanded = expandedId === sub._id;
            return (
              <div key={sub._id} className={`submission-card card ${isExpanded ? 'expanded' : ''}`}>
                <div className="submission-header" onClick={() => toggleExpand(sub._id)}>
                  <div className="submission-num">{idx + 1}</div>
                  <div className="submission-info">
                    <div className="submission-badges">
                      <span className="badge dept">{sub.department}</span>
                      <span className="badge shift">{sub.shift}</span>
                      <span className="badge gender">{sub.gender}</span>
                      <span className="badge songs-count">🎵 {songs.length} song{songs.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="submission-members">
                      <strong>Members:</strong> {sub.members?.join(', ') || '-'}
                    </div>
                  </div>
                  <div className="submission-date">{new Date(sub.createdAt).toLocaleDateString()}</div>
                  <div className="expand-icon">{isExpanded ? '▲' : '▼'}</div>
                </div>

                
                {isExpanded && (
                  <div className="submission-details">
                    <div className="details-section">
                      <h4>🎵 Songs ({songs.length})</h4>
                      <div className="songs-grid">
                        {songs.map((song, i) => (
                          <div key={i} className="song-detail-card">
                            <div className="song-detail-num">{i + 1}</div>
                            <div className="song-detail-info">
                              <div className="song-detail-name">{song.songName || 'Untitled'}</div>
                              {song.youtubeLink && (
                                <a href={song.youtubeLink} target="_blank" rel="noopener noreferrer" className="song-detail-link">
                                  🔗 Listen on YouTube
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="details-actions">
                      <button className="btn btn-outline" onClick={() => handleEdit(sub)}>✏️ Edit</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(sub._id)}>🗑️ Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!submissions.length && (
            <div className="empty-state card">No submissions found</div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Submission</h3>
              <button className="modal-close" onClick={() => setEditModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="label">Department</label>
                <select className="select" value={editModal.department}
                  onChange={e => setEditModal({...editModal, department: e.target.value})}>
                  {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="label">Shift</label>
                  <select className="select" value={editModal.shift}
                    onChange={e => setEditModal({...editModal, shift: e.target.value})}>
                    {shifts.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Type</label>
                  <select className="select" value={editModal.gender}
                    onChange={e => setEditModal({...editModal, gender: e.target.value})}>
                    <option value="Boys">Boys</option>
                    <option value="Girls">Girls</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="label">Members</label>
                {editModal.members.map((m, i) => (
                  <div key={i} className="member-edit-row">
                    <input type="text" className="input" value={m}
                      onChange={e => {
                        const newMembers = [...editModal.members];
                        newMembers[i] = e.target.value;
                        setEditModal({...editModal, members: newMembers});
                      }} />
                    <button className="btn-remove" onClick={() => {
                      setEditModal({...editModal, members: editModal.members.filter((_, idx) => idx !== i)});
                    }}>×</button>
                  </div>
                ))}
                <button className="btn btn-outline btn-sm" onClick={() => {
                  setEditModal({...editModal, members: [...editModal.members, '']});
                }}>+ Add Member</button>
              </div>
              <div className="form-group">
                <label className="label">Songs ({editModal.songs.length})</label>
                {editModal.songs.map((song, i) => (
                  <div key={i} className="song-edit-row">
                    <span className="song-edit-num">{i + 1}.</span>
                    <input type="text" className="input" placeholder="Song name" value={song.songName || ''}
                      onChange={e => {
                        const newSongs = [...editModal.songs];
                        newSongs[i] = {...newSongs[i], songName: e.target.value};
                        setEditModal({...editModal, songs: newSongs});
                      }} />
                    {song.youtubeLink && (
                      <a href={song.youtubeLink} target="_blank" rel="noopener noreferrer">🔗</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Submissions;
