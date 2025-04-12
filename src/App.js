import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink, Navigate } from 'react-router-dom';
import GenerateLabels from './components/GenerateLabels';
import PrintSettings from './components/PrintSettings';
import MonthlyCount from './components/MonthlyCount';
import WeeklyCount from './components/WeeklyCount';
import Login from './components/Login';
import Graphs from './components/Dashboard';
import Overview from './components/Overview';
import AuditTrail from './components/AuditTrail'; // New component
import LocationSelection from './components/LocationSelection';
import ErrorBoundary from './components/ErrorBoundary';
import supabase from './utils/supabaseClient';
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
      const { data: session } = await supabase.auth.getSession();

      if (session?.session && storedLocation && storedUserType) {
        setIsAuthenticated(true);
        setUserType(storedUserType);
        setSelectedLocation(storedLocation);
      } else {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        setUserType('');
        setSelectedLocation('');
        localStorage.removeItem('userType');
        localStorage.removeItem('selectedLocation');
      }
      setLoading(false);
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setIsAuthenticated(true);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUserType('');
        setSelectedLocation('');
        localStorage.removeItem('userType');
        localStorage.removeItem('selectedLocation');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (type) => {
    setUserType(type);
    localStorage.setItem('userType', type);
    setIsAuthenticated(true);
  };

  const handleLocationSelect = (location) => {
    if (!['MtD', 'FtP', 'HSTD', '3PL'].includes(location)) {
      console.error('Invalid location selected:', location);
      return;
    }
    setSelectedLocation(location);
    localStorage.setItem('selectedLocation', location);
  };

  const handleLogout = async () => {
    const { data: userData } = await supabase.auth.getUser();
    let userId = userData?.user?.id;

    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUserType('');
    setSelectedLocation('');
    localStorage.removeItem('userType');
    localStorage.removeItem('selectedLocation');

    if (userId) {
      await supabase.from('user_sessions').delete().eq('user_id', userId);
    }
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
                    <NavLink to="/generate-labels" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                      Generate Labels
                    </NavLink>
                    <NavLink to="/print-settings" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                      Print Settings
                    </NavLink>
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
                <Route path="/generate-labels" element={<GenerateLabels selectedLocation={selectedLocation} />} />
                <Route path="/print-settings" element={<PrintSettings />} />
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