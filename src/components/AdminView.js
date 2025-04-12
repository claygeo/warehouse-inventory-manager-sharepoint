import React, { useState, useEffect, useRef } from 'react';
import supabase from '../utils/supabaseClient';
import { DateTime } from 'luxon';

const AdminView = ({ userType, selectedLocation }) => {
  const [components, setComponents] = useState([]);
  const [cycleProgress, setCycleProgress] = useState({});
  const [countSources, setCountSources] = useState({});
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('');
  const [isCounting, setIsCounting] = useState(false);
  const barcodeInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const [showNextButton, setShowNextButton] = useState(false);
  const [showAllSkus, setShowAllSkus] = useState(false);

  useEffect(() => {
    console.log('AdminView mounted with selectedLocation:', selectedLocation);
    const fetchData = async () => {
      await fetchComponents();
      await loadCycleProgress();
    };
    fetchData();
  }, [selectedLocation]);

  useEffect(() => {
    if (isCounting && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isCounting]);

  const fetchComponents = async () => {
    try {
      const { data, error } = await supabase.from('components').select('*');
      if (error) throw error;
      setComponents(data);

      const sources = {};
      for (const comp of data) {
        const source = await getCountSource(comp.barcode);
        sources[comp.barcode] = source;
      }
      setCountSources(sources);
    } catch (error) {
      setStatus(`Error fetching components: ${error.message}`);
      setStatusColor('red');
    }
  };

  const loadCycleProgress = async () => {
    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}`;
    try {
      const { data, error } = await supabase
        .from('cycle_counts')
        .select('*')
        .eq('id', cycleId)
        .eq('user_type', 'user')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setCycleProgress(data.progress || {});
        setIsCounting(!data.completed);
      } else {
        setCycleProgress({});
        setIsCounting(false);
      }
    } catch (error) {
      setStatus(`Error loading cycle count progress: ${error.message}`);
      setStatusColor('red');
    }
  };

  const startAdminView = async () => {
    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}`;
    const now = DateTime.now().setZone('UTC').toISO(); // Use UTC for consistency
    try {
      const { data: existingData, error: fetchError } = await supabase
        .from('cycle_counts')
        .select('progress, start_date')
        .eq('id', cycleId)
        .eq('user_type', 'user')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      const existingProgress = existingData ? existingData.progress || {} : {};
      const updatedProgress = { ...existingProgress, ...cycleProgress };

      const { error } = await supabase
        .from('cycle_counts')
        .upsert({
          id: cycleId,
          start_date: existingData?.start_date || now,
          last_updated: now,
          progress: updatedProgress,
          completed: false,
          user_type: 'user',
        });

      if (error) throw error;
      setIsCounting(true);
      setCycleProgress(updatedProgress);
      setStatus('Started admin view.');
      setStatusColor('green');
    } catch (error) {
      setStatus(`Error starting admin view: ${error.message}`);
      setStatusColor('red');
    }
  };

  const resetCycleCount = async () => {
    if (!window.confirm('Are you sure you want to reset the cycle count? This will clear all progress for this month.')) {
      return;
    }

    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}`;
    try {
      const { error } = await supabase
        .from('cycle_counts')
        .delete()
        .eq('id', cycleId)
        .eq('user_type', 'user');

      if (error) throw error;

      setCycleProgress({});
      setCountSources({});
      setIsCounting(false);
      setStatus('Cycle count has been reset.');
      setStatusColor('green');
    } catch (error) {
      setStatus(`Error resetting cycle count: ${error.message}`);
      setStatusColor('red');
    }
  };

  const logCountAction = async (sku, quantity, countType, countSession, source, timestamp) => {
    try {
      const { error } = await supabase
        .from('count_history')
        .insert({
          sku,
          quantity,
          count_type: countType,
          count_session: countSession,
          user_type: userType,
          source,
          timestamp,
          location: selectedLocation,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging count action:', error.message);
    }
  };

  const getCountSource = async (sku) => {
    try {
      const { data, error } = await supabase
        .from('count_history')
        .select('count_type, count_session, timestamp, source, location')
        .eq('sku', sku)
        .eq('location', selectedLocation)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        return data[0].source || 'No source information available';
      }
      return 'Not yet counted';
    } catch (error) {
      console.error('Error fetching count source:', error.message);
      return 'Error retrieving source';
    }
  };

  const getLocationQuantity = (component) => {
    switch (selectedLocation) {
      case 'MtD': return component.mtd_quantity ?? 0;
      case 'FtP': return component.ftp_quantity ?? 0;
      case 'HSTD': return component.hstd_quantity ?? 0;
      case '3PL': return component['3pl_quantity'] ?? 0;
      default: return 0;
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode) {
      setStatus('Please enter a barcode.');
      setStatusColor('red');
      setShowNextButton(true);
      return;
    }

    if (quantity === '') {
      setStatus('Please enter a quantity.');
      setStatusColor('red');
      setShowNextButton(true);
      return;
    }

    if (!selectedLocation) {
      setStatus('No location selected. Please select a location (MtD, FtP, HSTD, 3PL).');
      setStatusColor('red');
      setShowNextButton(true);
      return;
    }

    try {
      const { data: component, error: fetchError } = await supabase
        .from('components')
        .select('id, barcode, mtd_quantity, ftp_quantity, hstd_quantity, 3pl_quantity')
        .eq('barcode', barcode)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      const enteredQuantity = parseInt(quantity, 10);
      const actualQuantity = component ? getLocationQuantity(component) : 0;

      if (actualQuantity !== enteredQuantity) {
        setStatus(`Quantity does not match. Expected: ${actualQuantity}, Entered: ${enteredQuantity}. Please recount.`);
        setStatusColor('red');
        setShowNextButton(true);
        return;
      }

      const { data: weeklyData, error: weeklyError } = await supabase
        .from('weekly_counts_hstd')
        .select('progress, day')
        .eq('location', selectedLocation)
        .order('last_updated', { ascending: false });

      if (weeklyError && weeklyError.code !== 'PGRST116') throw weeklyError;

      let conflictFound = false;
      let conflictDay = '';
      let conflictQuantity = null;

      if (weeklyData) {
        for (const weekly of weeklyData) {
          if (weekly.progress[barcode] !== undefined && weekly.progress[barcode] !== enteredQuantity) {
            conflictFound = true;
            conflictDay = weekly.day;
            conflictQuantity = weekly.progress[barcode];
            break;
          }
        }
      }

      if (conflictFound) {
        if (
          !window.confirm(
            `This SKU was previously counted with a quantity of ${conflictQuantity} in the ${conflictDay} weekly count at ${selectedLocation}. Do you want to update it to ${enteredQuantity}?`
          )
        ) {
          setStatus('Count not updated. Please recount if necessary.');
          setStatusColor('red');
          setShowNextButton(true);
          return;
        }
      }

      const quantityFieldMap = {
        'MtD': 'mtd_quantity',
        'FtP': 'ftp_quantity',
        'HSTD': 'hstd_quantity',
        '3PL': '3pl_quantity',
      };
      const quantityField = quantityFieldMap[selectedLocation];
      console.log('handleScan - Selected Location:', selectedLocation, 'Quantity Field:', quantityField);

      if (!quantityField) {
        throw new Error(`Invalid location: ${selectedLocation}. Expected one of: MtD, FtP, HSTD, 3PL`);
      }

      if (component) {
        const { error: updateError } = await supabase
          .from('components')
          .update({ [quantityField]: enteredQuantity })
          .eq('id', component.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('components')
          .insert({ barcode, [quantityField]: enteredQuantity });

        if (insertError) throw insertError;
      }

      const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}`;
      const now = DateTime.now().setZone('UTC');
      const timestamp = now.toISO();
      const newCycleProgress = { ...cycleProgress, [barcode]: enteredQuantity };

      const { data: cycleData, error: cycleFetchError } = await supabase
        .from('cycle_counts')
        .select('start_date')
        .eq('id', cycleId)
        .eq('user_type', 'user')
        .single();

      if (cycleFetchError && cycleFetchError.code !== 'PGRST116') throw cycleFetchError;

      const { error: cycleUpdateError } = await supabase
        .from('cycle_counts')
        .upsert({
          id: cycleId,
          start_date: cycleData?.start_date || timestamp,
          last_updated: timestamp,
          progress: newCycleProgress,
          completed: Object.keys(newCycleProgress).length === components.length,
          user_type: 'user',
        });

      if (cycleUpdateError) throw cycleUpdateError;

      setCycleProgress(newCycleProgress);

      const source = `Counted on ${now.toFormat('MM/dd/yyyy')} at ${now.toFormat('hh:mm:ss a')} using the Admin View at ${selectedLocation}`;
      await logCountAction(barcode, enteredQuantity, 'admin', cycleId, source, timestamp);

      const updatedSource = await getCountSource(barcode);
      setCountSources((prev) => ({ ...prev, [barcode]: updatedSource }));

      setStatus(`Counted ${barcode} successfully at ${selectedLocation}!`);
      setStatusColor('green');
      setShowNextButton(true);

      await fetchComponents();
    } catch (error) {
      setStatus(`Error updating quantity: ${error.message}`);
      setStatusColor('red');
      setShowNextButton(true);
    }
  };

  const handleNext = () => {
    setBarcode('');
    setQuantity('');
    setStatus('');
    setStatusColor('');
    setShowNextButton(false);
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const handleBarcodeKeyPress = (e) => {
    if (e.key === 'Enter' && barcode) {
      e.preventDefault();
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
      }
    }
  };

  const handleQuantityKeyPress = (e) => {
    if (e.key === 'Enter' && quantity !== '') {
      e.preventDefault();
      handleScan(e);
    }
  };

  const toggleShowAllSkus = () => {
    setShowAllSkus(!showAllSkus);
  };

  return (
    <div className="bg-curaleaf-light p-8 rounded-xl shadow-soft">
      <h2 className="text-2xl font-semibold text-curaleaf-dark mb-6 text-center">Admin View - {selectedLocation}</h2>

      {!isCounting && (
        <div className="text-center mb-6">
          <button
            onClick={startAdminView}
            className="bg-curaleaf-teal text-white p-3 rounded-lg hover:bg-curaleaf-accent transition-all w-full max-w-xs shadow-sm"
          >
            {Object.keys(cycleProgress).length > 0 ? 'Resume Admin View' : 'Start Admin View'}
          </button>
        </div>
      )}

      {isCounting && (
        <>
          <div className="mb-6">
            <label className="block text-curaleaf-dark mb-2 font-medium">
              Progress: {Object.keys(cycleProgress).length}/{components.length} SKUs Counted
            </label>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-curaleaf-teal h-4 rounded-full"
                style={{ width: `${(Object.keys(cycleProgress).length / components.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-curaleaf-dark mb-2">SKUs to Count:</h3>
            <ul className="list-disc pl-5">
              {(showAllSkus ? components : components.slice(0, 5)).map((comp) => (
                <li
                  key={comp.barcode}
                  className={cycleProgress[comp.barcode] !== undefined ? 'text-green-600' : 'text-curaleaf-dark'}
                >
                  {comp.barcode}{' '}
                  {cycleProgress[comp.barcode] !== undefined
                    ? `(Counted: ${cycleProgress[comp.barcode]})`
                    : `(Expected: ${getLocationQuantity(comp)})`}
                  {countSources[comp.barcode] && (
                    <span className="text-sm italic"> - {countSources[comp.barcode]}</span>
                  )}
                </li>
              ))}
            </ul>
            {components.length > 5 && (
              <button onClick={toggleShowAllSkus} className="mt-2 text-curaleaf-teal hover:underline">
                {showAllSkus ? 'Show Less' : 'See More'}
              </button>
            )}
          </div>

          <form onSubmit={handleScan}>
            <div className="mb-6">
              <label className="block text-curaleaf-dark mb-2 font-medium">Scan Barcode:</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyPress={handleBarcodeKeyPress}
                ref={barcodeInputRef}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal shadow-sm"
                placeholder="Scan or enter barcode"
              />
            </div>
            <div className="mb-6">
              <label className="block text-curaleaf-dark mb-2 font-medium">Quantity:</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyPress={handleQuantityKeyPress}
                ref={quantityInputRef}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal shadow-sm"
                placeholder="Enter quantity"
              />
            </div>
            {!showNextButton && (
              <div className="text-center">
                <button
                  type="submit"
                  className="bg-curaleaf-teal text-white p-3 rounded-lg hover:bg-curaleaf-accent transition-all w-full max-w-xs shadow-sm"
                >
                  Submit Count
                </button>
              </div>
            )}
          </form>

          {showNextButton && (
            <div className="text-center mt-4">
              <button
                onClick={handleNext}
                className="bg-curaleaf-teal text-white p-3 rounded-lg hover:bg-curaleaf-accent transition-all w-full max-w-xs shadow-sm"
              >
                Next
              </button>
            </div>
          )}

          <div className="text-center mt-6">
            <button
              onClick={resetCycleCount}
              className="bg-red-500 text-white p-3 rounded-lg hover:bg-red-700 transition-all w-full max-w-xs shadow-sm"
            >
              Reset Cycle Count
            </button>
          </div>
        </>
      )}

      {status && (
        <p
          className={`mt-6 text-center italic ${
            statusColor === 'red' ? 'text-red-500' : statusColor === 'green' ? 'text-green-600' : 'text-curaleaf-dark'
          }`}
        >
          {status}
        </p>
      )}
    </div>
  );
};

export default AdminView;