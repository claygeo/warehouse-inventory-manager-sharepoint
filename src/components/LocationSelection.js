// src/components/LocationSelection.js
import React, { useState } from 'react';
import { getCurrentUser } from '../utils/authProvider';
import { insertUserSession } from '../utils/graphClient';
import { DateTime } from 'luxon';

const LocationSelection = ({ onLocationSelect }) => {
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const locations = ['MtD', 'FtP', 'HSTD', '3PL'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) {
      setError('Please select a location.');
      return;
    }

    try {
      const user = getCurrentUser();
      if (!user) {
        setError('Please log in first.');
        return;
      }

      await insertUserSession({
        user_id: user.localAccountId,
        location,
        created_at: DateTime.now().setZone('UTC').toISO()
      });

      onLocationSelect(location);
    } catch (err) {
      setError(`Error saving location: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-curaleaf-bg">
      <div className="bg-curaleaf-light p-8 rounded-xl shadow-soft max-w-md w-full">
        <h2 className="text-2xl font-semibold text-curaleaf-dark mb-6 text-center">Select Your Location</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-curaleaf-dark mb-2 font-medium">Location:</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal shadow-sm"
            >
              <option value="">Select a location</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-red-500 text-center italic mb-4">{error}</p>
          )}
          <div className="text-center">
            <button
              type="submit"
              className="bg-curaleaf-teal text-white p-3 rounded-lg hover:bg-curaleaf-accent transition-all w-full shadow-sm"
            >
              Confirm Location
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LocationSelection;