// src/components/WeeklyCount.js
import React, { useState, useEffect, useRef } from 'react';
import { DateTime } from 'luxon';
import {
  fetchComponents,
  fetchHighVolumeSkus,
  fetchWeeklyCountsHstd,
  fetchCountHistory,
  upsertWeeklyCountsHstd,
  insertCountHistory,
  fetchCycleCounts,
  upsertCycleCounts,
  updateComponent,
  deleteWeeklyCount,
  deleteCountHistory
} from '../utils/graphClient';

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

  const loadSkusAndProgress = async (day) => {
    try {
      const skus = await fetchHighVolumeSkus(day);
      setSkusToCount(skus);

      const countId = `${day}_${new Date().toISOString().split('T')[0]}`;
      const weeklyData = await fetchWeeklyCountsHstd(selectedLocation);
      let weeklyProgress = {};
      const matchingData = weeklyData.find(data => data.id === countId);
      if (matchingData) {
        weeklyProgress = matchingData.progress || {};
        setIsCounting(!matchingData.completed);
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
      await upsertWeeklyCountsHstd({
        id: countId,
        day: selectedDay,
        date: now,
        last_updated: now,
        progress,
        completed: false,
        location: 'HSTD'
      });
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
      const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
      const cycleData = await fetchCycleCounts(cycleId, selectedLocation);
      if (cycleData) {
        const cycleProgress = { ...cycleData.progress };
        Object.keys(progress).forEach((sku) => {
          delete cycleProgress[sku];
        });
        await upsertCycleCounts({
          id: cycleId,
          start_date: cycleData.start_date || DateTime.now().setZone('UTC').toISO(),
          last_updated: DateTime.now().setZone('UTC').toISO(),
          progress: cycleProgress,
          completed: false,
          user_type: 'user',
          location: selectedLocation
        });
      }

      // Clear count history for this weekly count
      const startDate = DateTime.now().startOf('day').toISO();
      const endDate = DateTime.now().endOf('day').toISO();
      for (const sku of Object.keys(progress)) {
        await deleteCountHistory(sku, startDate, endDate, selectedLocation);
      }

      await deleteWeeklyCount(countId);
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
      await upsertWeeklyCountsHstd({
        id: countId,
        day: selectedDay,
        date: progress.start_date || now,
        last_updated: now,
        progress: newProgress,
        completed,
        location: 'HSTD'
      });

      const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
      const cycleData = await fetchCycleCounts(cycleId, selectedLocation);
      if (cycleData) {
        const cycleProgress = { ...cycleData.progress };
        delete cycleProgress[sku];
        await upsertCycleCounts({
          id: cycleId,
          start_date: cycleData.start_date || now,
          last_updated: now,
          progress: cycleProgress,
          completed: false,
          user_type: 'user',
          location: selectedLocation
        });
      }

      // Clear count history for this SKU
      const startDate = DateTime.now().startOf('day').toISO();
      const endDate = DateTime.now().endOf('day').toISO();
      await deleteCountHistory(sku, startDate, endDate, selectedLocation);

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
      const existingData = await fetchWeeklyCountsHstd(selectedLocation);
      const matchingData = existingData.find(data => data.id === countId);
      await upsertWeeklyCountsHstd({
        id: countId,
        day: selectedDay,
        date: matchingData?.date || now,
        last_updated: now,
        progress,
        completed,
        location: 'HSTD'
      });

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
      await insertCountHistory({
        sku,
        quantity,
        count_type: countType,
        count_session: countSession,
        user_type: userType,
        source,
        timestamp,
        location: selectedLocation
      });
    } catch (error) {
      console.error('Error logging count action:', error.message);
    }
  };

  const updateCycleCount = async (sku, quantity) => {
    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
    const now = DateTime.now().setZone('UTC').toISO();

    try {
      const cycleData = await fetchCycleCounts(cycleId, selectedLocation);
      const cycleProgress = cycleData ? { ...cycleData.progress } : {};
      cycleProgress[sku] = quantity;

      await upsertCycleCounts({
        id: cycleId,
        start_date: cycleData?.start_date || now,
        last_updated: now,
        progress: cycleProgress,
        completed: false,
        user_type: 'user',
        location: selectedLocation
      });
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
      const components = await fetchComponents();
      const component = components.find(c => c.barcode === barcode);
      const enteredQuantity = parseInt(quantity, 10);
      const actualQuantity = component ? component.hstd_quantity ?? 0 : 0;

      if (actualQuantity !== enteredQuantity) {
        setStatus(`Quantity does not match. Expected: ${actualQuantity}, Entered: ${enteredQuantity}. Please recount.`);
        setStatusColor('red');
        setShowNextButton(true);
        return;
      }

      const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
      const cycleData = await fetchCycleCounts(cycleId, selectedLocation);
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

      if (component) {
        await updateComponent(barcode, { hstd_quantity: enteredQuantity });
      } else {
        await updateComponent(barcode, { hstd_quantity: enteredQuantity, description: '', total_quantity: enteredQuantity });
      }

      const now = DateTime.now().setZone('UTC');
      const timestamp = now.toISO();
      await updateCycleCount(barcode, enteredQuantity);

      const countId = `${selectedDay}_${new Date().toISOString().split('T')[0]}`;
      const source = `Counted on ${now.toFormat('MM/dd/yyyy')} at ${now.toFormat('hh:mm:ss a')} using the Weekly Count at ${selectedLocation}`;
      await logCountAction(barcode, enteredQuantity, 'weekly', countId, source, timestamp);

      const existingData = await fetchWeeklyCountsHstd(selectedLocation);
      const matchingData = existingData.find(data => data.id === countId);
      await upsertWeeklyCountsHstd({
        id: countId,
        day: selectedDay,
        date: matchingData?.date || timestamp,
        last_updated: timestamp,
        progress: newProgress,
        completed: Object.keys(newProgress).length === skusToCount.length,
        location: 'HSTD'
      });

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