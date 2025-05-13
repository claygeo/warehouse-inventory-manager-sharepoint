import React, { useState } from 'react';
import supabase from '../utils/supabaseClient';
import '../styles/Login.css';

const Login = ({ onLogin }) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    console.log('Attempting login with passcode:', passcode);

    if (!passcode) {
      setError('Please enter a passcode.');
      setIsLoading(false);
      return;
    }

    try {
      // Sign in anonymously (optional, depending on your auth setup)
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) {
        console.error('Auth error:', authError);
        setError('Failed to create session: ' + authError.message);
        setIsLoading(false);
        return;
      }

      // Query passcodes table
      const { data: passcodeData, error: passcodeError } = await supabase
        .from('passcodes')
        .select('user_type')
        .eq('passcode', passcode)
        .single();

      if (passcodeError) {
        console.error('Passcode query error:', passcodeError);
        await supabase.auth.signOut();
        setError(`Invalid passcode: ${passcodeError.message}`);
        setIsLoading(false);
        return;
      }

      if (!passcodeData) {
        await supabase.auth.signOut();
        setError('Invalid passcode. Please try again.');
        setIsLoading(false);
        return;
      }

      onLogin(passcodeData.user_type);
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError('An unexpected error occurred: ' + err.message);
      await supabase.auth.signOut();
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/curaleaf.png" alt="Curaleaf Logo" className="login-logo" />
        <h2 className="login-title">Curaleaf Inventory Manager</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-curaleaf-dark mb-2 font-medium">Enter Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full"
              placeholder="••••"
              disabled={isLoading}
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className={`btn-primary w-full ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;