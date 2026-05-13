import React, { useState } from 'react';
import '../App.css';

const UserManagement = () => {
  const [users, setUsers] = useState([
    {
      id: 1,
      fullName: 'Eriza Enriquez-Santos',
      username: 'admin',
      role: 'Administrator',
      status: 'Active'
    },
    {
      id: 2,
      fullName: 'Jimmy Capalad',
      username: 'staff1',
      role: 'Utility Staff',
      status: 'Active'
    },
    {
      id: 3,
      fullName: 'Mark Santos',
      username: 'maint1',
      role: 'Maintenance Personnel',
      status: 'Inactive'
    }
  ]);

  const [activityLogs, setActivityLogs] = useState([
    'Admin account created',
    'Utility Staff role assigned to staff1',
    'maint1 account status changed to Inactive'
  ]);

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    role: 'Utility Staff',
    status: 'Active'
  });

  const [editingUserId, setEditingUserId] = useState(null);

  const addLog = (message) => {
    setActivityLogs((prev) => [
      `${new Date().toLocaleString()} - ${message}`,
      ...prev
    ]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      username: '',
      password: '',
      role: 'Utility Staff',
      status: 'Active'
    });
    setEditingUserId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.fullName || !formData.username || !formData.role) {
      alert('Please fill in all required fields.');
      return;
    }

    if (editingUserId) {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUserId
            ? {
                ...user,
                fullName: formData.fullName,
                username: formData.username,
                role: formData.role,
                status: formData.status
              }
            : user
        )
      );
      addLog(`Updated user: ${formData.username}`);
    } else {
      const newUser = {
        id: Date.now(),
        fullName: formData.fullName,
        username: formData.username,
        role: formData.role,
        status: formData.status
      };

      setUsers((prev) => [...prev, newUser]);
      addLog(`Added new user: ${formData.username}`);
    }

    resetForm();
  };

  const handleEdit = (user) => {
    setFormData({
      fullName: user.fullName,
      username: user.username,
      password: '',
      role: user.role,
      status: user.status
    });
    setEditingUserId(user.id);
  };

  const handleDelete = (id) => {
    const selectedUser = users.find((user) => user.id === id);
    if (!window.confirm(`Delete user "${selectedUser.username}"?`)) return;

    setUsers((prev) => prev.filter((user) => user.id !== id));
    addLog(`Deleted user: ${selectedUser.username}`);

    if (editingUserId === id) {
      resetForm();
    }
  };

  const toggleStatus = (id) => {
    setUsers((prev) =>
      prev.map((user) => {
        if (user.id === id) {
          const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
          addLog(`Changed account status of ${user.username} to ${newStatus}`);
          return { ...user, status: newStatus };
        }
        return user;
      })
    );
  };

  return (
    <div className="user-management-container">
      <h2>User Management</h2>
      <p className="section-description">Admin panel for managing system users</p>

      <div className="user-management-grid">
        {/* Form Section */}
        <div className="card">
          <h3>{editingUserId ? 'Edit User' : 'Add User'}</h3>

          <form onSubmit={handleSubmit} className="user-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Enter full name"
              />
            </div>

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="Administrator">Administrator</option>
                <option value="Utility Staff">Utility Staff</option>
                <option value="Maintenance Personnel">Maintenance Personnel</option>
              </select>
            </div>

            <div className="form-group">
              <label>Account Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="button-group">
              <button type="submit" className="btn-primary">
                {editingUserId ? 'Update User' : 'Add User'}
              </button>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* Users Table */}
        <div className="card">
          <h3>User List</h3>

          <div className="table-wrapper">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.fullName}</td>
                      <td>{user.username}</td>
                      <td>{user.role}</td>
                      <td>
                        <span
                          className={
                            user.status === 'Active'
                              ? 'status-badge active'
                              : 'status-badge inactive'
                          }
                        >
                          {user.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-edit"
                            onClick={() => handleEdit(user)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-toggle"
                            onClick={() => toggleStatus(user.id)}
                          >
                            Toggle Status
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(user.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="no-data">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Log */}
        <div className="card full-width">
          <h3>Activity Log</h3>
          <ul className="activity-log">
            {activityLogs.length > 0 ? (
              activityLogs.map((log, index) => <li key={index}>{log}</li>)
            ) : (
              <li>No activity yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;