import React, { useState, useEffect } from 'react';
import supabase from '../utils/supabaseClient';
import { DateTime } from 'luxon';

const AuditTrail = ({ userType, selectedLocation }) => {
  const [auditData, setAuditData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [filterAction, setFilterAction] = useState('');
  const [filterSKU, setFilterSKU] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  useEffect(() => {
    fetchAuditData();
  }, [selectedLocation]);

  const fetchAuditData = async () => {
    try {
      const [countHistory, userSessions, weeklyCounts] = await Promise.all([
        supabase.from('count_history').select('*').eq('location', selectedLocation).order('timestamp', { ascending: false }),
        supabase.from('user_sessions').select('*').order('created_at', { ascending: false }),
        supabase.from('weekly_counts_hstd').select('*').eq('location', selectedLocation).order('last_updated', { ascending: false }),
      ]);

      if (countHistory.error) throw countHistory.error;
      if (userSessions.error) throw userSessions.error;
      if (weeklyCounts.error) throw weeklyCounts.error;

      const combinedData = [
        ...countHistory.data.map((entry) => ({
          timestamp: entry.timestamp,
          action: 'Scan',
          sku: entry.sku,
          details: `Quantity: ${entry.quantity} at ${entry.location}`,
          user: entry.user_type === 'admin' ? 'Admin' : 'User',
          icon: '📦',
        })),
        ...userSessions.data.map((entry) => ({
          timestamp: entry.created_at,
          action: entry.event_type === 'login' ? 'Login' : 'Logout',
          sku: '-',
          details: `${entry.event_type === 'login' ? 'Logged in' : 'Logged out'} at ${selectedLocation}`,
          user: entry.user_type === 'admin' ? 'Admin' : 'User',
          icon: entry.event_type === 'login' ? '🔑' : '🚪',
        })),
        ...weeklyCounts.data.map((entry) => ({
          timestamp: entry.last_updated,
          action: 'Weekly Count',
          sku: '-',
          details: `Completed count for ${Object.keys(entry.progress).length} SKUs on ${entry.day}`,
          user: 'User',
          icon: '📅',
        })),
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by timestamp descending

      setAuditData(combinedData);
      setFilteredData(combinedData);
    } catch (error) {
      console.error('Error fetching audit data:', error.message);
    }
  };

  const applyFilters = () => {
    let result = [...auditData];

    if (filterAction) {
      result = result.filter((entry) => entry.action.toLowerCase().includes(filterAction.toLowerCase()));
    }
    if (filterSKU) {
      result = result.filter((entry) => entry.sku.toLowerCase().includes(filterSKU.toLowerCase()));
    }
    if (filterDateStart) {
      const start = DateTime.fromISO(filterDateStart).startOf('day');
      result = result.filter((entry) => DateTime.fromISO(entry.timestamp) >= start);
    }
    if (filterDateEnd) {
      const end = DateTime.fromISO(filterDateEnd).endOf('day');
      result = result.filter((entry) => DateTime.fromISO(entry.timestamp) <= end);
    }

    setFilteredData(result);
    setCurrentPage(1); // Reset to first page after filtering
  };

  useEffect(() => {
    applyFilters();
  }, [filterAction, filterSKU, filterDateStart, filterDateEnd]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="bg-curaleaf-light min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-curaleaf-dark mb-8 text-center">Audit Trail</h2>
        <p className="text-center text-curaleaf-dark mb-6">View all changes and actions at {selectedLocation}</p>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-curaleaf-dark mb-2 font-medium">Action Type</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal"
              >
                <option value="">All Actions</option>
                <option value="Scan">Scan</option>
                <option value="Login">Login</option>
                <option value="Logout">Logout</option>
                <option value="Weekly Count">Weekly Count</option>
              </select>
            </div>
            <div>
              <label className="block text-curaleaf-dark mb-2 font-medium">SKU</label>
              <input
                type="text"
                value={filterSKU}
                onChange={(e) => setFilterSKU(e.target.value)}
                placeholder="e.g., SKU123"
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal"
              />
            </div>
            <div>
              <label className="block text-curaleaf-dark mb-2 font-medium">Start Date</label>
              <input
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal"
              />
            </div>
            <div>
              <label className="block text-curaleaf-dark mb-2 font-medium">End Date</label>
              <input
                type="date"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal"
              />
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          {filteredData.length === 0 ? (
            <p className="text-center text-curaleaf-dark">No actions found matching your filters.</p>
          ) : (
            <>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-curaleaf-teal text-white">
                    <th className="p-3">Date/Time</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Details</th>
                    <th className="p-3">User</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((entry, index) => (
                    <tr key={index} className="border-b hover:bg-gray-100">
                      <td className="p-3">
                        {DateTime.fromISO(entry.timestamp).toFormat('MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="p-3">
                        <span className="flex items-center">
                          <span className="mr-2">{entry.icon}</span>
                          {entry.action}
                        </span>
                      </td>
                      <td className="p-3">{entry.sku}</td>
                      <td className="p-3">{entry.details}</td>
                      <td className="p-3">{entry.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-curaleaf-teal text-white rounded-lg disabled:bg-gray-300"
                >
                  Previous
                </button>
                <span className="text-curaleaf-dark">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-curaleaf-teal text-white rounded-lg disabled:bg-gray-300"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditTrail;