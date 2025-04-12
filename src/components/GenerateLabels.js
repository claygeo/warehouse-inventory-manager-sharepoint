import React, { useState } from 'react';
import axios from 'axios';
import supabase from '../utils/supabaseClient';

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
      let id, description, quantity;

      // Handle format: (ID,Description,Quantity) or (ID,Quantity)
      if (line.startsWith('(') && line.includes(')')) {
        const pairs = line.replace(/\)\s*\(/g, ')|(').split('|').map(pair => pair.replace(/[()]/g, '').trim());
        pairs.forEach(pair => {
          const parts = pair.split(',').map(item => item.trim());
          if (parts.length === 3) {
            [id, description, quantity] = parts;
            components.push({
              id,
              barcode: id,
              description,
              [getQuantityField(selectedLocation)]: parseInt(quantity) || 0,
            });
          } else if (parts.length === 2) {
            [id, quantity] = parts;
            components.push({
              id,
              barcode: id,
              description: '', // Optional, defaults to empty string
              [getQuantityField(selectedLocation)]: parseInt(quantity) || 0,
            });
          }
        });
      }
      // Handle format: ID,Description,Quantity or ID,Quantity
      else {
        const parts = line.split(',').map(item => item.trim());
        if (parts.length === 3) {
          [id, description, quantity] = parts;
          components.push({
            id,
            barcode: id,
            description,
            [getQuantityField(selectedLocation)]: parseInt(quantity) || 0,
          });
        } else if (parts.length === 2) {
          [id, quantity] = parts;
          components.push({
            id,
            barcode: id,
            description: '', // Optional, defaults to empty string
            [getQuantityField(selectedLocation)]: parseInt(quantity) || 0,
          });
        } else {
          setStatus(`Error: Invalid format at line ${index + 1}. Expected 'ID,Description,Quantity', 'ID,Quantity', '(ID,Description,Quantity)', or '(ID,Quantity)'.`);
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
      '3PL': '3pl_quantity',
    };
    if (!quantityFieldMap[location]) {
      console.error(`Invalid location: ${location}. Defaulting to 'hstd_quantity'.`);
      return 'hstd_quantity'; // Fallback to HSTD if invalid
    }
    return quantityFieldMap[location];
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
        components = lines.map(line => {
          const parts = line.split(',');
          if (parts.length === 3) {
            const [id, description, quantity] = parts;
            return {
              id: id.trim(),
              barcode: id.trim(),
              description: description.trim(),
              [getQuantityField(selectedLocation)]: parseInt(quantity) || 0,
            };
          } else if (parts.length === 2) {
            const [id, quantity] = parts;
            return {
              id: id.trim(),
              barcode: id.trim(),
              description: '', // Optional, defaults to empty string
              [getQuantityField(selectedLocation)]: parseInt(quantity) || 0,
            };
          } else {
            setStatus('Error: Invalid CSV format. Expected "ID,Description,Quantity" or "ID,Quantity".');
            return null;
          }
        }).filter(comp => comp !== null);
        console.log('Parsed components from file:', components);
        if (components.length > 0) {
          processComponents(components);
        }
      };
      reader.readAsText(file);
    } else if (manualInput) {
      components = parseManualInput(manualInput);
      if (components.length === 0) {
        setStatus('No valid components found. Please use format "ID,Description,Quantity", "ID,Quantity", "(ID,Description,Quantity)", or "(ID,Quantity)".');
        return;
      }
      processComponents(components);
    } else {
      setStatus('Please provide input data.');
    }
  };

  const processComponents = async (components) => {
    try {
      // Prepare components with total_quantity
      const updatedComponents = await Promise.all(
        components.map(async (comp) => {
          const { data: existing, error: fetchError } = await supabase
            .from('components')
            .select('mtd_quantity, ftp_quantity, hstd_quantity, 3pl_quantity, total_quantity')
            .eq('id', comp.id)
            .maybeSingle();

          if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

          const locationField = getQuantityField(selectedLocation);
          const newQuantity = comp[locationField] || 0;

          if (existing) {
            // If SKU exists, calculate new total_quantity
            const currentQuantities = {
              mtd_quantity: existing.mtd_quantity || 0,
              ftp_quantity: existing.ftp_quantity || 0,
              hstd_quantity: existing.hstd_quantity || 0,
              '3pl_quantity': existing['3pl_quantity'] || 0, // Quote the key here
            };
            // Update only the selected location's quantity
            currentQuantities[locationField] = newQuantity;
            const totalQuantity = Object.values(currentQuantities).reduce((sum, qty) => sum + qty, 0);
            return {
              ...comp,
              ...currentQuantities, // Include all location quantities
              total_quantity: totalQuantity,
            };
          } else {
            // New SKU, total_quantity is just the entered quantity
            return {
              ...comp,
              mtd_quantity: selectedLocation === 'MtD' ? newQuantity : 0,
              ftp_quantity: selectedLocation === 'FtP' ? newQuantity : 0,
              hstd_quantity: selectedLocation === 'HSTD' ? newQuantity : 0,
              '3pl_quantity': selectedLocation === '3PL' ? newQuantity : 0, // Quote the key here
              total_quantity: newQuantity,
            };
          }
        })
      );

      // Sync with Supabase
      const { data, error } = await supabase.from('components').upsert(updatedComponents, { onConflict: 'id' });
      if (error) throw error;

      console.log('Components synced to Supabase:', data);

      // Generate labels (send only the necessary fields to the API)
      const labelComponents = updatedComponents.map(comp => ({
        id: comp.id,
        barcode: comp.barcode,
        description: comp.description,
        quantity: comp[getQuantityField(selectedLocation)],
      }));
      const labelResponse = await axios.post(
        'http://localhost:5000/api/generate-labels',
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
      setStatus('Labels generated and new components synced successfully!');
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
            placeholder="e.g., SKU123,Widget,10 or SKU123,10"
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