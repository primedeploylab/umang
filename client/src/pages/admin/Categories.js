import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api';
import './Categories.css';

function Categories() {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('department');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch (error) {
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post('/categories', { name: newName.trim(), type: newType });
      setNewName('');
      fetchCategories();
      toast.success('Added successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add');
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      await api.put(`/categories/${id}`, { name: editName.trim() });
      setEditId(null);
      fetchCategories();
      toast.success('Updated successfully');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
      toast.success('Deleted successfully');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const departments = categories.filter(c => c.type === 'department');
  const shifts = categories.filter(c => c.type === 'shift');

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="categories-page">
      <div className="page-header">
        <h1>Departments & Shifts</h1>
        <p>Manage departments and shift types</p>
      </div>

      <div className="add-form card">
        <h3>Add New</h3>
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <select className="select" value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option value="department">Department</option>
              <option value="shift">Shift</option>
            </select>
            <input
              type="text"
              className="input"
              placeholder="Enter name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Add</button>
          </div>
        </form>
      </div>

      <div className="categories-grid">
        <div className="category-section card">
          <h3>📁 Departments</h3>
          <div className="category-list">
            {departments.map((cat) => (
              <div key={cat._id} className="category-item">
                {editId === cat._id ? (
                  <div className="edit-row">
                    <input
                      type="text"
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-success btn-sm" onClick={() => handleUpdate(cat._id)}>Save</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="category-name">{cat.name}</span>
                    <div className="category-actions">
                      <button className="btn-icon" onClick={() => { setEditId(cat._id); setEditName(cat.name); }}>✏️</button>
                      <button className="btn-icon danger" onClick={() => handleDelete(cat._id)}>🗑️</button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {!departments.length && <p className="empty">No departments</p>}
          </div>
        </div>

        <div className="category-section card">
          <h3>⏰ Shifts</h3>
          <div className="category-list">
            {shifts.map((cat) => (
              <div key={cat._id} className="category-item">
                {editId === cat._id ? (
                  <div className="edit-row">
                    <input
                      type="text"
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-success btn-sm" onClick={() => handleUpdate(cat._id)}>Save</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="category-name">{cat.name}</span>
                    <div className="category-actions">
                      <button className="btn-icon" onClick={() => { setEditId(cat._id); setEditName(cat.name); }}>✏️</button>
                      <button className="btn-icon danger" onClick={() => handleDelete(cat._id)}>🗑️</button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {!shifts.length && <p className="empty">No shifts</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Categories;
