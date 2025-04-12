import React, { useState, useEffect } from 'react';
import axios from 'axios';
import supabase from '../utils/supabaseClient';

const PrintSettings = () => {
  const [components, setComponents] = useState([]);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeId] = useState(true);
  const [labelSize, setLabelSize] = useState('4x1.5');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    try {
      const { data, error } = await supabase.from('components').select('*');
      if (error) throw error;
      setComponents(data);
    } catch (error) {
      setStatus(`Error loading components: ${error.message}`);
    }
  };

  const handleSelect = (id) => {
    setSelectedComponents((prev) =>
      prev.includes(id) ? prev.filter((compId) => compId !== id) : [...prev, id]
    );
  };

  const handlePrint = async () => {
    if (selectedComponents.length === 0) {
      setStatus('Please select at least one component to print.');
      return;
    }

    const selected = components
      .filter((comp) => selectedComponents.includes(comp.id))
      .map(comp => ({
        id: comp.id,
        barcode: comp.barcode,
        description: comp.description || '',
        quantity: comp.quantity || 0,
        location: comp.location || 'Warehouse',
      }));

    const [width, height] = labelSize.split('x').map(Number);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/generate-labels',
        { components: selected, includeId, labelSize: { width, height } },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'selected_labels.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus('Labels printed successfully!');
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const filteredComponents = components.filter(comp =>
    comp.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (comp.description && comp.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-curaleaf-light p-8 rounded-xl shadow-soft">
      <h2 className="text-2xl font-semibold text-curaleaf-dark mb-6 text-center">Print Settings</h2>
      <div className="mb-6">
        <label className="block text-curaleaf-dark mb-2 font-medium">Search Components:</label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal shadow-sm"
          placeholder="Search by barcode or description..."
        />
      </div>
      <div className="mb-6">
        <label className="block text-curaleaf-dark mb-2 font-medium">Select Components to Print:</label>
        <div className="max-h-64 overflow-y-auto border rounded-lg p-4 bg-white shadow-sm">
          {filteredComponents.map((comp) => (
            <div key={comp.id} className="flex items-center py-2">
              <input
                type="checkbox"
                checked={selectedComponents.includes(comp.id)}
                onChange={() => handleSelect(comp.id)}
                className="mr-3 h-5 w-5 text-curaleaf-teal focus:ring-curaleaf-teal rounded"
              />
              <span className="text-curaleaf-dark">{`${comp.id} - ${comp.description || 'No Description'} (Barcode: ${comp.barcode})`}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <label className="block text-curaleaf-dark mb-2 font-medium">Label Size (inches):</label>
        <select
          value={labelSize}
          onChange={(e) => setLabelSize(e.target.value)}
          className="w-full max-w-xs p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal shadow-sm"
        >
          <option value="4x1.5">4 x 1.5</option>
          <option value="3x1">3 x 1</option>
          <option value="2x1">2 x 1</option>
        </select>
      </div>
      <div className="text-center">
        <button
          onClick={handlePrint}
          className="bg-curaleaf-teal text-white p-3 rounded-lg hover:bg-curaleaf-accent transition-all w-full max-w-xs shadow-sm"
        >
          Print Selected Labels
        </button>
      </div>
      {status && <p className="mt-6 text-curaleaf-dark text-center italic">{status}</p>}
    </div>
  );
};

export default PrintSettings;