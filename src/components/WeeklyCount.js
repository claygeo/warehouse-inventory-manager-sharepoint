import React, { useState, useEffect, useRef } from 'react';
import supabase from '../utils/supabaseClient';
import { DateTime } from 'luxon';

const WeeklyCount = ({ userType, selectedLocation }) => {
  const [selectedDay, setSelectedDay] = useState('');
  const [skusToCount, setSkusToCount] = useState([]);
  const [progress, setProgress] = useState({});
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('');
  const [isCounting, setIsCounting] = useState(false);
  const [statusColor, setStatusColor] = useState('');
  const barcodeInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const [showNextButton, setShowNextButton] = useState(false);
  const [showAllSkus, setShowAllSkus] = useState(false);

  useEffect(() => {
    if (selectedDay) {
      loadSkusAndProgress(selectedDay);
    }
  }, [selectedDay]);

  useEffect(() => {
    if (isCounting && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isCounting]);

  useEffect(() => {
    const subscription = supabase
      .channel('components-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'components', filter: `hstd_quantity=neq.NULL` },
        (payload) => {
          const updatedBarcode = payload.new.barcode;
          const updatedQuantity = payload.new.hstd_quantity;
          if (skusToCount.includes(updatedBarcode)) {
            setProgress((prev) => ({
              ...prev,
              [updatedBarcode]: updatedQuantity,
            }));
            setStatus(`Updated ${updatedBarcode} to ${updatedQuantity} from components table.`);
            setStatusColor('green');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [skusToCount]);

  const loadSkusAndProgress = async (day) => {
    try {
      // Fetch SKUs from high_volume_skus
      const { data: skuData, error: skuError } = await supabase
        .from('high_volume_skus')
        .select('sku')
        .eq('day', day)
        .eq('location', 'HSTD');

      if (skuError) throw skuError;

      const skus = skuData.map((item) => item.sku);
      setSkusToCount(skus);

      // Fetch weekly count progress from weekly_counts_hstd
      const countId = `${day}_${new Date().toISOString().split('T')[0]}`;
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('weekly_counts_hstd')
        .select('progress, completed')
        .eq('id', countId)
        .eq('location', 'HSTD')
        .maybeSingle();

      if (weeklyError) throw weeklyError;

      let weeklyProgress = {};
      if (weeklyData) {
        weeklyProgress = weeklyData.progress || {};
        setIsCounting(!weeklyData.completed);
      } else {
        setIsCounting(false);
      }

      setProgress(weeklyProgress);
    } catch (error) {
      setStatus(`Error loading SKUs or progress: ${error.message}`);
      setStatusColor('red');
    }
  };

  const startCount = async () => {
    if (!selectedDay) {
      setStatus('Please select a day to start counting.');
      setStatusColor('red');
      return;
    }

    setIsCounting(true);
    const countId = `${selectedDay}_${new Date().toISOString().split('T')[0]}`;
    const now = DateTime.now().setZone('UTC').toISO();
    try {
      const { error } = await supabase
        .from('weekly_counts_hstd')
        .upsert({
          id: countId,
          day: selectedDay,
          date: now,
          last_updated: now,
          progress: progress,
          completed: false,
          location: 'HSTD',
        });

      if (error) throw error;
      setStatus(`Started weekly count for ${selectedDay}`);
      setStatusColor('green');
    } catch (error) {
      setStatus(`Error starting count: ${error.message}`);
      setStatusColor('red');
    }
  };

  const resetCount = async () => {
    if (!selectedDay) {
      setStatus('Please select a day to reset.');
      setStatusColor('red');
      return;
    }

    if (!window.confirm(`Are you sure you want to reset the count for ${selectedDay}? This will clear all progress.`)) {
      return;
    }

    const countId = `${selectedDay}_${new Date().toISOString().split('T')[0]}`;
    try {
      const { data: cycleData, error: cycleError } = await supabase
        .from('cycle_counts')
        .select('progress')
        .eq('id', `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`)
        .eq('user_type', 'user')
        .eq('location', selectedLocation)
        .single();

      if (cycleError && cycleError.code !== 'PGRST116') throw cycleError;

      if (cycleData) {
        const cycleProgress = { ...cycleData.progress };
        Object.keys(progress).forEach((sku) => {
          delete cycleProgress[sku];
        });

        const { error: updateError } = await supabase
          .from('cycle_counts')
          .upsert({
            id: `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`,
            start_date: cycleData.start_date || DateTime.now().setZone('UTC').toISO(),
            last_updated: DateTime.now().setZone('UTC').toISO(),
            progress: cycleProgress,
            completed: false,
            user_type: 'user',
            location: selectedLocation,
          });

        if (updateError) throw updateError;
      }

      const { error } = await supabase
        .from('weekly_counts_hstd')
        .delete()
        .eq('id', countId);

      if (error) throw error;

      setProgress({});
      setIsCounting(false);
      await loadSkusAndProgress(selectedDay);
      setStatus(`Count for ${selectedDay} has been reset.`);
      setStatusColor('green');
    } catch (error) {
      setStatus(`Error resetting count: ${error.message}`);
      setStatusColor('red');
    }
  };

  const removeSku = async (sku) => {
    const newProgress = { ...progress };
    delete newProgress[sku];
    setProgress(newProgress);

    const countId = `${selectedDay}_${new Date().toISOString().split('T')[0]}`;
    const now = DateTime.now().setZone('UTC').toISO();
    const completed = Object.keys(newProgress).length === skusToCount.length;

    try {
      const { error: weeklyError } = await supabase
        .from('weekly_counts_hstd')
        .upsert({
          id: countId,
          day: selectedDay,
          date: progress.start_date || now,
          last_updated: now,
          progress: newProgress,
          completed,
          location: 'HSTD',
        });

      if (weeklyError) throw weeklyError;

      const { data: cycleData, error: cycleError } = await supabase
        .from('cycle_counts')
        .select('progress')
        .eq('id', `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`)
        .eq('user_type', 'user')
        .eq('location', selectedLocation)
        .single();

      if (cycleError && cycleError.code !== 'PGRST116') throw cycleError;

      if (cycleData) {
        const cycleProgress = { ...cycleData.progress };
        delete cycleProgress[sku];

        const { error: updateError } = await supabase
          .from('cycle_counts')
          .upsert({
            id: `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`,
            start_date: cycleData.start_date || now,
            last_updated: now,
            progress: cycleProgress,
            completed: false,
            user_type: 'user',
            location: selectedLocation,
          });

        if (updateError) throw updateError;
      }

      setStatus(`Removed ${sku} from count.`);
      setStatusColor('green');
    } catch (error) {
      setStatus(`Error removing SKU: ${error.message}`);
      setStatusColor('red');
    }
  };

  const saveProgress = async () => {
    if (!selectedDay) return;

    const countId = `${selectedDay}_${new Date().toISOString().split('T')[0]}`;
    const now = DateTime.now().setZone('UTC').toISO();
    const completed = Object.keys(progress).length === skusToCount.length;

    try {
      const { data: existingData, error: fetchError } = await supabase
        .from('weekly_counts_hstd')
        .select('date')
        .eq('id', countId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      const { error } = await supabase
        .from('weekly_counts_hstd')
        .upsert({
          id: countId,
          day: selectedDay,
          date: existingData?.date || now,
          last_updated: now,
          progress,
          completed,
          location: 'HSTD',
        });

      if (error) throw error;

      setStatus('Progress saved successfully!');
      setStatusColor('green');
      if (completed) {
        setIsCounting(false);
        setStatus(`Weekly count for ${selectedDay} completed!`);
        setStatusColor('green');
      }
    } catch (error) {
      setStatus(`Error saving progress: ${error.message}`);
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

  const updateCycleCount = async (sku, quantity) => {
    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
    const now = DateTime.now().setZone('UTC').toISO();

    try {
      const { data: cycleData, error: fetchError } = await supabase
        .from('cycle_counts')
        .select('progress, start_date')
        .eq('id', cycleId)
        .eq('user_type', 'user')
        .eq('location', selectedLocation)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const cycleProgress = cycleData ? { ...cycleData.progress } : {};
      cycleProgress[sku] = quantity;

      const { error: updateError } = await supabase
        .from('cycle_counts')
        .upsert({
          id: cycleId,
          start_date: cycleData?.start_date || now,
          last_updated: now,
          progress: cycleProgress,
          completed: false,
          user_type: 'user',
          location: selectedLocation,
        });

      if (updateError) throw updateError;
    } catch (error) {
      setStatus(`Error updating cycle count: ${error.message}`);
      setStatusColor('red');
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

    if (!skusToCount.includes(barcode)) {
      setStatus(`Barcode ${barcode} is not part of the ${selectedDay} weekly count.`);
      setStatusColor('red');
      setShowNextButton(true);
      return;
    }

    try {
      const { data: component, error: fetchError } = await supabase
        .from('components')
        .select('barcode, hstd_quantity')
        .eq('barcode', barcode)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      const enteredQuantity = parseInt(quantity, 10);
      const actualQuantity = component ? (component.hstd_quantity ?? 0) : 0;

      if (actualQuantity !== enteredQuantity) {
        setStatus(`Quantity does not match. Expected: ${actualQuantity}, Entered: ${enteredQuantity}. Please recount.`);
        setStatusColor('red');
        setShowNextButton(true);
        return;
      }

      const { data: cycleData, error: cycleError } = await supabase
        .from('cycle_counts')
        .select('progress')
        .eq('id', `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`)
        .eq('user_type', 'user')
        .eq('location', selectedLocation)
        .single();

      if (cycleError && cycleError.code !== 'PGRST116') throw cycleError;

      if (cycleData && cycleData.progress[barcode] !== undefined && cycleData.progress[barcode] !== enteredQuantity) {
        if (!window.confirm(`This SKU was previously counted with a quantity of ${cycleData.progress[barcode]} in the cycle count. Do you want to update it to ${enteredQuantity}?`)) {
          setStatus('Count not updated. Please recount if necessary.');
          setStatusColor('red');
          setShowNextButton(true);
          return;
        }
      }

      const newProgress = { ...progress, [barcode]: enteredQuantity };
      setProgress(newProgress);

      const quantityFieldMap = {
        'MtD': 'mtd_quantity',
        'FtP': 'ftp_quantity',
        'HSTD': 'hstd_quantity',
        '3PL': '3pl_quantity',
      };
      const quantityField = quantityFieldMap[selectedLocation];
      console.log('Selected Location:', selectedLocation, 'Quantity Field:', quantityField);

      if (!quantityField) {
        throw new Error(`Invalid location: ${selectedLocation}. Expected one of: MtD, FtP, HSTD, 3PL`);
      }

      if (component) {
        const { error: updateError } = await supabase
          .from('components')
          .update({ [quantityField]: enteredQuantity })
          .eq('barcode', barcode);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('components')
          .insert({ barcode, [quantityField]: enteredQuantity });

        if (insertError) throw insertError;
      }

      const now = DateTime.now().setZone('UTC');
      const timestamp = now.toISO();
      await updateCycleCount(barcode, enteredQuantity);

      const countId = `${selectedDay}_${new Date().toISOString().split('T')[0]}`;
      const source = `Counted on ${now.toFormat('MM/dd/yyyy')} at ${now.toFormat('hh:mm:ss a')} using the Weekly Count at ${selectedLocation}`;
      await logCountAction(barcode, enteredQuantity, 'weekly', countId, source, timestamp);

      const { data: existingData, error: fetchError2 } = await supabase
        .from('weekly_counts_hstd')
        .select('date')
        .eq('id', countId)
        .single();

      if (fetchError2 && fetchError2.code !== 'PGRST116') throw fetchError2;

      const { error: updateWeeklyError } = await supabase
        .from('weekly_counts_hstd')
        .upsert({
          id: countId,
          day: selectedDay,
          date: existingData?.date || timestamp,
          last_updated: timestamp,
          progress: newProgress,
          completed: Object.keys(newProgress).length === skusToCount.length,
          location: 'HSTD',
        });

      if (updateWeeklyError) throw updateWeeklyError;

      setStatus(actualQuantity !== null ? 'Quantity matches!' : `Counted ${barcode} successfully at ${selectedLocation}!`);
      setStatusColor('green');
      setShowNextButton(true);
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

  const getProgressPercentage = () => {
    if (!skusToCount.length) return 0;
    const counted = Object.keys(progress).length;
    return (counted / skusToCount.length) * 100;
  };

  const toggleShowAllSkus = () => {
    setShowAllSkus(!showAllSkus);
  };

  return (
    <div className="bg-curaleaf-light p-8 rounded-xl shadow-soft">
      <h2 className="text-2xl font-semibold text-curaleaf-dark mb-6 text-center">Weekly Count - HSTD</h2>

      <div className="mb-6">
        <label className="block text-curaleaf-dark mb-2 font-medium">Select Day:</label>
        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(e.target.value)}
          className="w-full max-w-xs p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-curaleaf-teal shadow-sm"
        >
          <option value="">Select a day</option>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
      </div>

      {selectedDay && !isCounting && (
        <div className="text-center mb-6">
          <button
            onClick={startCount}
            className="bg-curaleaf-teal text-white p-3 rounded-lg hover:bg-curaleaf-accent transition-all w-full max-w-xs shadow-sm"
          >
            {Object.keys(progress).length > 0 ? 'Resume Count' : 'Start Count'}
          </button>
        </div>
      )}

      {isCounting && (
        <>
          <div className="mb-6">
            <label className="block text-curaleaf-dark mb-2 font-medium">
              Progress: {Object.keys(progress).length}/{skusToCount.length} SKUs Counted
            </label>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-curaleaf-teal h-4 rounded-full"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-curaleaf-dark mb-2">SKUs to Count:</h3>
            <ul className="list-disc pl-5">
              {(showAllSkus ? skusToCount : skusToCount.slice(0, 5)).map((sku) => (
                <li key={sku} className={progress[sku] !== undefined ? 'text-green-600' : 'text-curaleaf-dark'}>
                  {sku} {progress[sku] !== undefined ? `(Counted: ${progress[sku]})` : '(Not Counted)'}
                  {progress[sku] !== undefined && (
                    <button
                      onClick={() => removeSku(sku)}
                      className="ml-2 text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {skusToCount.length > 5 && (
              <button
                onClick={toggleShowAllSkus}
                className="mt-2 text-curaleaf-teal hover:underline"
              >
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

          <div className="text-center mt-6 flex justify-center space-x-4">
            <button
              onClick={saveProgress}
              className="bg-curaleaf-accent text-white p-3 rounded-lg hover:bg-curaleaf-teal transition-all w-full max-w-xs shadow-sm"
            >
              Save Progress
            </button>
            <button
              onClick={resetCount}
              className="bg-red-500 text-white p-3 rounded-lg hover:bg-red-700 transition-all w-full max-w-xs shadow-sm"
            >
              Reset Count
            </button>
          </div>
        </>
      )}

      {status && (
        <p className={`mt-6 text-center italic ${statusColor === 'red' ? 'text-red-500' : statusColor === 'green' ? 'text-green-600' : 'text-curaleaf-dark'}`}>
          {status}
        </p>
      )}
    </div>
  );
};

export default WeeklyCount;