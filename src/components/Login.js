// src/components/Login.js
import React, { useState } from 'react';
import { login } from '../utils/authProvider';
import '../styles/Login.css';

const Login = ({ onLogin }) => {
  const [userType, setUserType] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userType) {
      setError('Please select a user type');
      return;
    }

    try {
      await login();
      onLogin(userType);
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to log in. Please check your credentials or configuration.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logo.png" alt="Curaleaf Logo" className="login-logo" />
        <h2 className="login-title">Curaleaf Inventory Login</h2>
        {error && <p className="login-error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-curaleaf-dark mb-2 font-medium">User Type:</label>
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal shadow-sm"
            >
              <option value="">Select User Type</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
          <div className="text-center">
            <button
              type="submit"
              className="bg-curaleaf-teal text-white p-3 rounded-lg hover:bg-curaleaf-accent transition-all w-full shadow-sm"
            >
              Login with Microsoft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;