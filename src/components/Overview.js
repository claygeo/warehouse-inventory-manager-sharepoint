import React from 'react';
import { Link } from 'react-router-dom';

const Overview = ({ userType, selectedLocation }) => {
  const features = [
    {
      title: 'Dashboard & Graphs',
      description: 'View inventory trends and analytics for your location.',
      path: '/graphs',
      icon: '📊',
    },
    {
      title: 'Generate Labels',
      description: 'Create barcode labels for new products.',
      path: '/generate-labels',
      icon: '🏷️',
    },
    {
      title: 'Print Settings',
      description: 'Configure printing options for labels.',
      path: '/print-settings',
      icon: '⚙️',
    },
    {
      title: 'Monthly Count',
      description: 'Perform and review monthly inventory counts.',
      path: '/monthly-count',
      icon: '📋',
    },
    ...(userType === 'user' && selectedLocation === 'HSTD'
      ? [{
          title: 'Weekly Count',
          description: 'Track weekly counts for high-volume SKUs.',
          path: '/weekly-count',
          icon: '📅',
        }]
      : []),
    {
      title: 'Audit Trail',
      description: 'See a history of all actions and changes.',
      path: '/audit-trail',
      icon: '🕒', // Clock icon for history/timeline
    },
  ];

  return (
    <div className="bg-curaleaf-light min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-curaleaf-dark">Welcome to Curaleaf Inventory</h1>
          <p className="mt-2 text-lg text-curaleaf-dark">
            {userType === 'admin' ? 'Administrator' : 'User'} Dashboard - Location: {selectedLocation}
          </p>
        </header>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Link
              key={feature.title}
              to={feature.path}
              className="bg-white p-6 rounded-xl shadow-soft hover:shadow-md transition-shadow duration-300 flex items-start space-x-4"
            >
              <span className="text-3xl">{feature.icon}</span>
              <div>
                <h2 className="text-xl font-semibold text-curaleaf-dark">{feature.title}</h2>
                <p className="mt-2 text-curaleaf-dark text-sm">{feature.description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer Info */}
        <footer className="mt-12 text-center text-curaleaf-dark text-sm">
          <p>Curaleaf Inventory System | Last Updated: {new Date().toLocaleDateString()}</p>
          <p>Manage your inventory with ease and precision.</p>
        </footer>
      </div>
    </div>
  );
};

export default Overview;