import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import './SubmitForm.css';

// Generate unique device ID
const getDeviceId = () => {
  let deviceId = localStorage.getItem('dmart_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('dmart_device_id', deviceId);
  }
  return deviceId;
};

// Save form data to localStorage
const saveFormData = (linkId, data) => {
  localStorage.setItem(`dmart_form_${linkId}`, JSON.stringify(data));
};

// Load form data from localStorage
const loadFormData = (linkId) => {
  try {
    const saved = localStorage.getItem(`dmart_form_${linkId}`);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
};

// Clear form data from localStorage
const clearFormData = (linkId) => {
  localStorage.removeItem(`dmart_form_${linkId}`);
};

// Save submission ID after successful submission
const saveSubmissionId = (linkId, submissionId) => {
  localStorage.setItem(`dmart_submitted_${linkId}`, submissionId);
};

// Get saved submission ID
const getSubmissionId = (linkId) => {
  return localStorage.getItem(`dmart_submitted_${linkId}`);
};

function SubmitForm() {
  const { linkId } = useParams();
  const [valid, setValid] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  
  // Current song link being checked
  const [currentLink, setCurrentLink] = useState('');
  
  // Verified songs list (multiple songs)
  const [verifiedSongs, setVerifiedSongs] = useState([]);
  
  // Already submitted state
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [editMode, setEditMode] = useState(false);
  
  // Step: 1 = Add Songs, 2 = Fill Details
  const [step, setStep] = useState(1);
  
  // Form details (shared for all songs)
  const [form, setForm] = useState({
    department: '',
    shift: '',
    gender: ''
  });
  const [members, setMembers] = useState(['']);

  const shifts = ['Full-Time', 'Part-Time', 'Mixed'];
  const genders = ['Boys', 'Girls'];
  const deviceId = getDeviceId();

  // Load saved data on mount
  useEffect(() => {
    const checkExistingSubmission = async () => {
      const submissionId = getSubmissionId(linkId);
      if (submissionId) {
        try {
          const { data } = await axios.get(`/api/submissions/by-id/${submissionId}`);
          if (data) {
            setExistingSubmission(data);
            // Load existing data into form for editing
            const songs = data.songs?.length > 0 ? data.songs : 
              (data.youtubeLink ? [{ songName: data.songName, youtubeLink: data.youtubeLink }] : []);
            setVerifiedSongs(songs.map((s, i) => ({
              id: Date.now() + i,
              link: s.youtubeLink,
              name: s.songName || '',
              fingerprint: s.fingerprint
            })));
            setForm({
              department: data.department || '',
              shift: data.shift || '',
              gender: data.gender || ''
            });
            setMembers(data.members?.length > 0 ? data.members : ['']);
            setEditMode(true);
            setStep(2); // Go directly to details step
          }
        } catch (e) {
          // Submission not found, clear saved ID
          localStorage.removeItem(`dmart_submitted_${linkId}`);
        }
      } else {
        // Load draft data if no submission
        const saved = loadFormData(linkId);
        if (saved) {
          if (saved.verifiedSongs) setVerifiedSongs(saved.verifiedSongs);
          if (saved.form) setForm(saved.form);
          if (saved.members) setMembers(saved.members);
          if (saved.step) setStep(saved.step);
          if (saved.currentLink) setCurrentLink(saved.currentLink);
        }
      }
    };
    
    checkExistingSubmission();
    verifyLink();
  }, [linkId]);

  // Save data whenever it changes
  useEffect(() => {
    if (valid) {
      saveFormData(linkId, { verifiedSongs, form, members, step, currentLink });
    }
  }, [verifiedSongs, form, members, step, currentLink, linkId, valid]);

  const verifyLink = async () => {
    try {
      await axios.get(`/api/links/verify/${linkId}`);
      setValid(true);
      const { data } = await axios.get(`/api/categories/by-link/${linkId}`);
      setDepartments(data.filter(c => c.type === 'department'));
    } catch (error) {
      setValid(false);
    } finally {
      setLoading(false);
    }
  };

  const loadAllSongs = async () => {
    setLoadingSongs(true);
    try {
      const { data } = await axios.get(`/api/submissions/public/${linkId}`);
      setAllSubmissions(data);
      setShowAllSongs(true);
    } catch (error) {
      toast.error('Failed to load songs');
    } finally {
      setLoadingSongs(false);
    }
  };


  // Helper to extract YouTube video ID for local comparison
  const getVideoId = (url) => {
    if (!url) return null;
    const patterns = [
      /youtube\.com\/watch\?v=([^&\s?#]+)/,
      /youtu\.be\/([^&\s?#]+)/,
      /youtube\.com\/shorts\/([^&\s?#]+)/,
      /youtube\.com\/embed\/([^&\s?#]+)/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  };

  // Check if song is available and add to verified list
  const checkAndAddSong = async () => {
    if (!currentLink.trim()) {
      toast.error('Please paste a song link');
      return;
    }

    // Check if exact link already in verified list
    if (verifiedSongs.some(s => s.link === currentLink)) {
      toast.error('This song is already in your list');
      return;
    }

    // Check if same YouTube video ID already in verified list
    const newVideoId = getVideoId(currentLink);
    if (newVideoId) {
      for (const song of verifiedSongs) {
        const existingVideoId = getVideoId(song.link);
        if (existingVideoId && newVideoId === existingVideoId) {
          toast.error('⚠️ This is the same YouTube video as one you already added!');
          return;
        }
      }
    }

    setChecking(true);
    try {
      const formData = new FormData();
      formData.append('youtubeLink', currentLink);
      // Send pending links for same-song detection
      if (verifiedSongs.length > 0) {
        formData.append('pendingLinks', JSON.stringify(verifiedSongs.map(s => s.link)));
      }

      const { data } = await axios.post(`/api/submissions/check-song/${linkId}`, formData);
      
      // Add to verified songs
      const newSong = {
        id: Date.now(),
        link: currentLink,
        name: '',
        fingerprint: data.fingerprint
      };
      
      setVerifiedSongs([...verifiedSongs, newSong]);
      setCurrentLink('');
      toast.success('✅ Song added! You can add more songs or continue.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Song not available');
    } finally {
      setChecking(false);
    }
  };

  // Remove song from verified list
  const removeSong = (id) => {
    setVerifiedSongs(verifiedSongs.filter(s => s.id !== id));
  };



  // Update song name in verified list
  const updateSongName = (id, name) => {
    setVerifiedSongs(verifiedSongs.map(s => s.id === id ? { ...s, name } : s));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleMemberChange = (index, value) => {
    const newMembers = [...members];
    newMembers[index] = value;
    setMembers(newMembers);
  };

  const addMember = () => setMembers([...members, '']);
  
  const removeMember = (index) => {
    if (members.length > 1) setMembers(members.filter((_, i) => i !== index));
  };

  const goToStep2 = () => {
    if (verifiedSongs.length === 0) {
      toast.error('Please add at least one song');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Song names are now optional - no validation needed

    const validMembers = members.filter(m => m.trim());
    if (validMembers.length === 0) {
      toast.error('Please add at least one member name');
      return;
    }

    setSubmitting(true);
    try {
      // Submit all songs in ONE submission
      const songsData = verifiedSongs.map(song => ({
        songName: song.name || '',
        youtubeLink: song.link,
        fingerprint: song.fingerprint
      }));

      const formData = new FormData();
      formData.append('department', form.department);
      formData.append('shift', form.shift);
      formData.append('gender', form.gender);
      formData.append('members', JSON.stringify(validMembers));
      formData.append('deviceId', deviceId);
      formData.append('songs', JSON.stringify(songsData));

      let response;
      if (editMode && existingSubmission) {
        // Update existing submission
        response = await axios.put(`/api/submissions/edit/${existingSubmission._id}`, formData);
        toast.success('✅ Your submission has been updated!');
      } else {
        // Create new submission
        response = await axios.post(`/api/submissions/${linkId}`, formData);
        toast.success(`🎉 Submission with ${verifiedSongs.length} song(s) submitted successfully!`);
        
        // Save submission ID so user can only edit from now on
        if (response.data.submission?._id) {
          saveSubmissionId(linkId, response.data.submission._id);
          setExistingSubmission(response.data.submission);
          setEditMode(true);
        }
      }
      
      // Clear draft data but keep submission ID
      clearFormData(linkId);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="submit-page">
        <div className="submit-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="submit-page">
        <div className="submit-container">
          <div className="error-state card">
            <span className="error-icon">❌</span>
            <h2>Invalid Link</h2>
            <p>This submission link is invalid or has expired.</p>
          </div>
        </div>
      </div>
    );
  }


  // Get songs from submission (handles both new and legacy format)
  const getSubmissionSongs = (sub) => {
    if (sub.songs && sub.songs.length > 0) return sub.songs;
    if (sub.youtubeLink || sub.songName) {
      return [{ songName: sub.songName, youtubeLink: sub.youtubeLink }];
    }
    return [];
  };

  // View all songs modal
  if (showAllSongs) {
    return (
      <div className="submit-page">
        <div className="submit-container wide">
          <div className="card">
            <div className="songs-header">
              <h2>🎵 All Submissions ({allSubmissions.length})</h2>
              <button className="btn btn-outline" onClick={() => setShowAllSongs(false)}>
                ← Back to Form
              </button>
            </div>
            
            {allSubmissions.length === 0 ? (
              <p className="no-songs">No songs submitted yet. Be the first!</p>
            ) : (
              <div className="songs-list">
                {allSubmissions.map((sub, idx) => {
                  const songs = getSubmissionSongs(sub);
                  return (
                    <div key={sub._id} className="song-card">
                      <div className="song-number">{idx + 1}</div>
                      <div className="song-info">
                        <p className="song-meta">
                          <span className="dept-badge">{sub.department}</span>
                          <span className="shift-badge">{sub.shift}</span>
                          <span className="gender-badge">{sub.gender}</span>
                        </p>
                        <p className="members-list">
                          <strong>Members:</strong> {sub.members?.join(', ')}
                        </p>
                        <div className="submission-songs">
                          <strong>Songs ({songs.length}):</strong>
                          {songs.map((song, i) => (
                            <div key={i} className="submission-song-item">
                              <span>{i + 1}. {song.songName || 'Untitled'}</span>
                              {song.youtubeLink && (
                                <a href={song.youtubeLink} target="_blank" rel="noopener noreferrer">🔗</a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-page">
      <div className="submit-container">
        <div className="submit-card card">
          <div className="submit-header">
            <h1>🎵 DMart Umang</h1>
            <p>{editMode ? 'Edit Your Submission' : 'Group Song Submission'}</p>
            {editMode && (
              <div className="edit-mode-banner">
                ✅ You have already submitted. You can edit your submission below.
              </div>
            )}
            <button 
              className="btn btn-outline view-songs-btn" 
              onClick={loadAllSongs}
              disabled={loadingSongs}
            >
              {loadingSongs ? 'Loading...' : '👀 View All Submitted Songs'}
            </button>
          </div>

          {/* Step indicator - hide in edit mode */}
          {!editMode && (
            <div className="step-indicator">
              <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Add Songs</div>
              <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Fill Details</div>
            </div>
          )}

          {/* STEP 1: Add Multiple Songs */}
          {step === 1 && (
            <div className="step-content">
              <h3>Add your songs</h3>
              <p className="step-desc">Add one or more song links. We'll check each one for availability.</p>

              {/* Verified Songs List */}
              {verifiedSongs.length > 0 && (
                <div className="verified-songs-list">
                  <label className="label">Your Songs ({verifiedSongs.length})</label>
                  {verifiedSongs.map((song, idx) => (
                    <div key={song.id} className="verified-song-item">
                      <span className="song-num">{idx + 1}</span>
                      <a href={song.link} target="_blank" rel="noopener noreferrer" className="song-link-text" title="Open link">
                        🔗 {song.link.length > 40 ? song.link.substring(0, 40) + '...' : song.link}
                      </a>
                      <button type="button" className="btn-remove" onClick={() => removeSong(song.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Song */}
              <div className="add-song-section">
                <label className="label">{verifiedSongs.length > 0 ? 'Add Another Song' : 'Song Link'}</label>
                <div className="add-song-row">
                  <input 
                    type="url" 
                    className="input" 
                    placeholder="Paste YouTube/Spotify/JioSaavn link..." 
                    value={currentLink} 
                    onChange={(e) => setCurrentLink(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && checkAndAddSong()}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={checkAndAddSong}
                    disabled={checking || !currentLink.trim()}
                  >
                    {checking ? '...' : '+ Add'}
                  </button>
                </div>
                {checking && <p className="checking-text">Checking availability...</p>}
              </div>

              {/* Continue Button */}
              {verifiedSongs.length > 0 && (
                <button 
                  type="button" 
                  className="btn btn-primary submit-btn" 
                  onClick={goToStep2}
                >
                  Continue with {verifiedSongs.length} Song{verifiedSongs.length > 1 ? 's' : ''} →
                </button>
              )}
            </div>
          )}


          {/* STEP 2: Fill Details */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="submit-form">
              {/* Songs Summary */}
              <div className="songs-summary">
                <label className="label">Songs to Submit ({verifiedSongs.length})</label>
                {verifiedSongs.map((song, idx) => (
                  <div key={song.id} className="summary-song">
                    <span className="song-num">{idx + 1}</span>
                    <input
                      type="text"
                      className="input"
                      placeholder="Song name (optional)"
                      value={song.name}
                      onChange={(e) => updateSongName(song.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label className="label">Department *</label>
                <select name="department" className="select" value={form.department} onChange={handleChange} required>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="label">Shift *</label>
                  <select name="shift" className="select" value={form.shift} onChange={handleChange} required>
                    <option value="">Select Shift</option>
                    {shifts.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Group Type *</label>
                  <select name="gender" className="select" value={form.gender} onChange={handleChange} required>
                    <option value="">Select Type</option>
                    {genders.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="members-section">
                <div className="members-header">
                  <label className="label">Group Members *</label>
                  <button type="button" className="btn btn-outline btn-sm" onClick={addMember}>+ Add</button>
                </div>
                {members.map((member, index) => (
                  <div key={index} className="member-row">
                    <input
                      type="text"
                      className="input"
                      placeholder={`Member ${index + 1} Name`}
                      value={member}
                      onChange={(e) => handleMemberChange(index, e.target.value)}
                      required
                    />
                    {members.length > 1 && (
                      <button type="button" className="btn-remove" onClick={() => removeMember(index)}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div className="form-actions">
                {!editMode && (
                  <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
                )}
                <button type="submit" className="btn btn-primary submit-btn" disabled={submitting}>
                  {submitting ? 'Saving...' : editMode ? '💾 Save Changes' : `Submit ${verifiedSongs.length} Song${verifiedSongs.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubmitForm;
