// src/components/GenerateLabels.js
import React, { useState } from 'react';
import axios from 'axios';
import { fetchComponents, updateComponent } from '../utils/graphClient';

const GenerateLabels = ({ selectedLocation }) => {
  const [manualInput, setManualInput] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const parseManualInput = (input) => {
    const lines = input.split('\n').map(line => line.trim()).filter(line => line);
    const components = [];

    lines.forEach((line, index) => {
      let barcode, description, quantity;
      if (line.startsWith('(') && line.endsWith(')')) {
        const cleanedLine = line.slice(1, -1).trim();
        const parts = cleanedLine.split(',').map(item => item.trim());
        if (parts.length === 3 && parts[0] && !isNaN(parts[2])) {
          [barcode, description, quantity] = parts;
          components.push({
            barcode,
            description,
            [getQuantityField(selectedLocation)]: parseInt(quantity) || 0
          });
        } else if (parts.length === 2 && parts[0] && !isNaN(parts[1])) {
          [barcode, quantity] = parts;
          components.push({
            barcode,
            description: '',
            [getQuantityField(selectedLocation)]: parseInt(quantity) || 0
          });
        } else {
          setStatus(`Error: Invalid format at line ${index + 1}. Expected '(ID,Description,Quantity)' or '(ID,Quantity)'.`);
        }
      } else {
        const parts = line.split(',').map(item => item.trim());
        if (parts.length === 3 && parts[0] && !isNaN(parts[2])) {
          [barcode, description, quantity] = parts;
          components.push({
            barcode,
            description,
            [getQuantityField(selectedLocation)]: parseInt(quantity) || 0
          });
        } else if (parts.length === 2 && parts[0] && !isNaN(parts[1])) {
          [barcode, quantity] = parts;
          components.push({
            barcode,
            description: '',
            [getQuantityField(selectedLocation)]: parseInt(quantity) || 0
          });
        } else {
          setStatus(`Error: Invalid format at line ${index + 1}. Expected 'ID,Description,Quantity' or 'ID,Quantity'.`);
        }
      }
    });

    console.log('Parsed components:', components);
    return components;
  };

  const getQuantityField = (location) => {
    const quantityFieldMap = {
      'MtD': 'mtd_quantity',
      'FtP': 'ftp_quantity',
      'HSTD': 'hstd_quantity',
      '3PL': '3pl_quantity'
    };
    return quantityFieldMap[location] || 'hstd_quantity';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Processing...');

    if (!selectedLocation) {
      setStatus('Error: No location selected. Please select a location before generating labels.');
      return;
    }

    let components = [];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        components = lines.map((line, index) => {
          const parts = line.split(',').map(item => item.trim());
          if (parts.length === 3 && parts[0] && !isNaN(parts[2])) {
            const [barcode, description, quantity] = parts;
            return {
              barcode,
              description,
              [getQuantityField(selectedLocation)]: parseInt(quantity) || 0
            };
          } else if (parts.length === 2 && parts[0] && !isNaN(parts[1])) {
            const [barcode, quantity] = parts;
            return {
              barcode,
              description: '',
              [getQuantityField(selectedLocation)]: parseInt(quantity) || 0
            };
          } else {
            setStatus(`Error: Invalid CSV format at line ${index + 1}. Expected "ID,Description,Quantity" or "ID,Quantity".`);
            return null;
          }
        }).filter(comp => comp !== null);
        console.log('Parsed components from file:', components);
        if (components.length > 0) {
          processComponents(components);
        } else {
          setStatus('No valid components found in CSV.');
        }
      };
      reader.readAsText(file);
    } else if (manualInput) {
      components = parseManualInput(manualInput);
      if (components.length === 0) {
        setStatus('No valid components found. Please use format "ID,Description,Quantity" or "ID,Quantity".');
        return;
      }
      processComponents(components);
    } else {
      setStatus('Please provide input data (manual entry or CSV file).');
    }
  };

  const processComponents = async (components) => {
    try {
      const updatedComponents = await Promise.all(
        components.map(async (comp) => {
          const existingComponents = await fetchComponents();
          const existing = existingComponents.find(c => c.barcode === comp.barcode);

          const locationField = getQuantityField(selectedLocation);
          const newQuantity = comp[locationField] || 0;

          if (existing) {
            const currentQuantities = {
              mtd_quantity: existing.mtd_quantity || 0,
              ftp_quantity: existing.ftp_quantity || 0,
              hstd_quantity: existing.hstd_quantity || 0,
              '3pl_quantity': existing['3pl_quantity'] || 0,
              quarantine_quantity: existing.quarantine_quantity || 0
            };
            currentQuantities[locationField] = newQuantity;
            const totalQuantity = Object.values(currentQuantities).reduce((sum, qty) => sum + qty, 0);
            return {
              ...comp,
              ...currentQuantities,
              total_quantity: totalQuantity
            };
          } else {
            return {
              ...comp,
              mtd_quantity: selectedLocation === 'MtD' ? newQuantity : 0,
              ftp_quantity: selectedLocation === 'FtP' ? newQuantity : 0,
              hstd_quantity: selectedLocation === 'HSTD' ? newQuantity : 0,
              '3pl_quantity': selectedLocation === '3PL' ? newQuantity : 0,
              quarantine_quantity: 0,
              total_quantity: newQuantity
            };
          }
        })
      );

      await Promise.all(updatedComponents.map(comp => updateComponent(comp.barcode, comp)));

      console.log('Components synced to SharePoint:', updatedComponents);

      // Note: Backend auth for label generation is not supported with user-based MSAL.js
      // Request IT/higher-up for an Azure AD app or use Power Automate flow
      const labelComponents = updatedComponents.map(comp => ({
        id: comp.barcode,
        barcode: comp.barcode,
        description: comp.description,
        quantity: comp[getQuantityField(selectedLocation)]
      }));
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/generate-labels';
      try {
        const labelResponse = await axios.post(
          API_URL,
          { components: labelComponents, includeId: true, labelSize: { width: 4, height: 1.5 } },
          { responseType: 'blob' }
        );
        const url = window.URL.createObjectURL(new Blob([labelResponse.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'labels.pdf');
        document.body.appendChild(link);
        link.click();
        link.remove();
        setStatus('Labels generated and components synced successfully!');
      } catch (error) {
        setStatus('Components synced, but label generation failed. Contact IT for backend auth setup.');
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error('Error in processComponents:', error);
    }
  };

  return (
    <div className="bg-curaleaf-light p-8 rounded-xl shadow-soft">
      <h2 className="text-2xl font-semibold text-curaleaf-dark mb-6 text-center">Generate Barcode Labels for New Products</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block text-curaleaf-dark mb-2 font-medium">
            Location: {selectedLocation}
          </label>
          <p className="text-sm text-curaleaf-dark italic mb-2">
            Quantity will be added to {getQuantityField(selectedLocation).replace('_', ' ')} and total_quantity column.
          </p>
        </div>
        <div className="mb-6">
          <label className="block text-curaleaf-dark mb-2 font-medium">
            Manual Entry (ID,Description,Quantity or ID,Quantity - one per line):
          </label>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal shadow-sm"
            rows="5"
            placeholder="e.g., TEST123,Widget,10 or 123,10"
          />
        </div>
        <div className="mb-6">
          <label className="block text-curaleaf-dark mb-2 font-medium">
            Or Upload CSV File (ID,Description,Quantity or ID,Quantity):
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full p-3 border rounded-lg shadow-sm"
          />
        </div>
        <div className="text-center">
          <button
            type="submit"
            className="bg-curaleaf-teal text-white p-3 rounded-lg hover:bg-curaleaf-accent transition-all w-full max-w-xs shadow-sm"
          >
            Generate Labels & Sync
          </button>
        </div>
      </form>
      {status && <p className="mt-6 text-curaleaf-dark text-center italic">{status}</p>}
    </div>
  );
};

export default GenerateLabels;