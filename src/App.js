import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink, Navigate } from 'react-router-dom';
import GenerateLabels from './components/GenerateLabels';
import PrintSettings from './components/PrintSettings';
import MonthlyCount from './components/MonthlyCount';
import WeeklyCount from './components/WeeklyCount';
import Login from './components/Login';
import Graphs from './components/Dashboard';
import Overview from './components/Overview';
import AuditTrail from './components/AuditTrail';
import LocationSelection from './components/LocationSelection';
import ErrorBoundary from './components/ErrorBoundary';
import { getCurrentUser, logout } from './utils/authProvider';
import { insertUserSession } from './utils/graphClient';
import './styles/Nav.css';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const storedLocation = localStorage.getItem('selectedLocation');
      const storedUserType = localStorage.getItem('userType');
      const user = await getCurrentUser();

      if (user && storedLocation && storedUserType) {
        setIsAuthenticated(true);
        setUserType(storedUserType);
        setSelectedLocation(storedLocation);
      } else {
        await logout();
        setIsAuthenticated(false);
        setUserType('');
        setSelectedLocation('');
        localStorage.removeItem('userType');
        localStorage.removeItem('selectedLocation');
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const handleLogin = async (type) => {
    setUserType(type);
    localStorage.setItem('userType', type);
    setIsAuthenticated(true);
  };

  const handleLocationSelect = async (location) => {
    if (!['MtD', 'FtP', 'HSTD', '3PL'].includes(location)) {
      console.error('Invalid location selected:', location);
      return;
    }
    setSelectedLocation(location);
    localStorage.setItem('selectedLocation', location);

    const user = await getCurrentUser();
    if (user) {
      await insertUserSession({
        user_id: user.id,
        location,
        created_at: new Date().toISOString(),
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
    setUserType('');
    setSelectedLocation('');
    localStorage.removeItem('userType');
    localStorage.removeItem('selectedLocation');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-curaleaf-dark">Loading...</div>;
  }

  return (
    <Router>
      <div className="min-h-screen bg-curaleaf-bg">
        {!isAuthenticated ? (
          <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        ) : !selectedLocation ? (
          <LocationSelection onLocationSelect={handleLocationSelect} />
        ) : (
          <>
            <nav className="nav-bar">
              <div className="nav-container">
                <div className="nav-title">Curaleaf Inventory</div>
                <div className="nav-links-container">
                  <div className="nav-links">
                    <NavLink to="/overview" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                      Overview
                    </NavLink>
                    <NavLink to="/graphs" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                      Graphs
                    </NavLink>
                    {/* Comment out PDF routes if not using; remove comments if backend auth is set up
                    <NavLink to="/generate-labels" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                      Generate Labels
                    </NavLink>
                    <NavLink to="/print-settings" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                      Print Settings
                    </NavLink>
                    */}
                    <NavLink to="/monthly-count" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                      Monthly Count
                    </NavLink>
                    {userType === 'user' && selectedLocation === 'HSTD' && (
                      <NavLink to="/weekly-count" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                        Weekly Count
                      </NavLink>
                    )}
                    <NavLink to="/audit-trail" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                      Audit Trail
                    </NavLink>
                  </div>
                </div>
                <div className="nav-actions">
                  <span>Location: {selectedLocation}</span>
                  <button onClick={handleLogout} className="nav-logout">Logout</button>
                </div>
              </div>
            </nav>
            <div className="container mx-auto p-6">
              <Routes>
                <Route path="/overview" element={<Overview userType={userType} selectedLocation={selectedLocation} />} />
                <Route path="/graphs" element={<ErrorBoundary><Graphs selectedLocation={selectedLocation} /></ErrorBoundary>} />
                {/* Comment out PDF routes if not using; remove comments if backend auth is set up
                <Route path="/generate-labels" element={<GenerateLabels selectedLocation={selectedLocation} />} />
                <Route path="/print-settings" element={<PrintSettings selectedLocation={selectedLocation} />} />
                */}
                <Route path="/monthly-count" element={<MonthlyCount userType={userType} selectedLocation={selectedLocation} />} />
                <Route
                  path="/weekly-count"
                  element={
                    userType === 'user' && selectedLocation === 'HSTD' ? (
                      <WeeklyCount userType={userType} selectedLocation={selectedLocation} />
                    ) : (
                      <Navigate to="/overview" />
                    )
                  }
                />
                <Route path="/audit-trail" element={<AuditTrail userType={userType} selectedLocation={selectedLocation} />} />
                <Route path="/" element={<Navigate to="/overview" />} />
                <Route path="/location-selection" element={<LocationSelection onLocationSelect={handleLocationSelect} />} />
                <Route path="*" element={<Navigate to="/overview" />} />
              </Routes>
            </div>
          </>
        )}
      </div>
    </Router>
  );
};

export default App;