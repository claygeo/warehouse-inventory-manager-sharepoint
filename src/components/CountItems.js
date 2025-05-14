// src/components/CountItems.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DateTime } from 'luxon';
import {
  fetchComponents,
  fetchHighVolumeSkus,
  fetchCycleCounts,
  fetchWeeklyCountsHstd,
  fetchCountHistory,
  insertCountHistory,
  upsertCycleCounts,
  upsertWeeklyCountsHstd,
  updateComponent,
  deleteCycleCount,
  deleteWeeklyCount,
  deleteCountHistory
} from '../utils/graphClient';

const CountItems = ({ userType, selectedLocation }) => {
  const [components, setComponents] = useState([]);
  const [cycleProgress, setCycleProgress] = useState({});
  const [weeklyProgress, setWeeklyProgress] = useState({});
  const [countSources, setCountSources] = useState({});
  const [highVolumeSkus, setHighVolumeSkus] = useState([]);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('');
  const [isCounting, setIsCounting] = useState(false);
  const barcodeInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const [showNextButton, setShowNextButton] = useState(false);
  const [showAllSkus, setShowAllSkus] = useState(false);
  const [selectedSku, setSelectedSku] = useState(null);
  const [skuHistory, setSkuHistory] = useState({});

  const getCountSource = useCallback(async (sku) => {
    try {
      const data = await fetchCountHistory({ sku, location: selectedLocation });
      if (data && data.length > 0) {
        return data[0].source || 'No source information available';
      }
      return 'Not yet counted';
    } catch (error) {
      console.error('Error fetching count source:', error.message);
      return 'Error retrieving source';
    }
  }, [selectedLocation]);

  const fetchComponentsData = useCallback(async () => {
    try {
      const data = await fetchComponents();
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
  }, [getCountSource]);

  const fetchHighVolumeSkusData = useCallback(async () => {
    try {
      const currentDay = DateTime.now().toFormat('EEEE');
      const skus = await fetchHighVolumeSkus(currentDay);
      console.log('High-volume SKUs fetched:', skus);
      setHighVolumeSkus(skus);
    } catch (error) {
      setStatus(`Error fetching high-volume SKUs: ${error.message}`);
      setStatusColor('red');
    }
  }, []);

  const loadCycleProgress = useCallback(async () => {
    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
    try {
      const data = await fetchCycleCounts(cycleId, selectedLocation);
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
  }, [selectedLocation]);

  const loadWeeklyProgress = useCallback(async () => {
    const currentDay = DateTime.now().toFormat('EEEE');
    const weeklyId = `Weekly_${DateTime.now().toFormat('yyyy-MM-dd')}_HSTD_${currentDay}`;
    try {
      console.log('Loading weekly progress for ID:', weeklyId);
      const data = await fetchWeeklyCountsHstd(weeklyId);
      if (data) {
        setWeeklyProgress(data.progress || {});
        setIsCounting(!data.completed);
      } else {
        setWeeklyProgress({});
        setIsCounting(false);
      }
    } catch (error) {
      setStatus(`Error loading weekly count progress: ${error.message}`);
      setStatusColor('red');
    }
  }, []);

  useEffect(() => {
    console.log('CountItems mounted with selectedLocation:', selectedLocation);
    const fetchData = async () => {
      try {
        await fetchComponentsData();
        await loadCycleProgress();
        if (selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')) {
          await fetchHighVolumeSkusData();
          await loadWeeklyProgress();
        } else if (selectedLocation === 'HSTD') {
          await fetchHighVolumeSkusData();
        }
      } catch (error) {
        setStatus(`Error initializing data: ${error.message}`);
        setStatusColor('red');
      }
    };
    fetchData();
  }, [selectedLocation, fetchComponentsData, loadCycleProgress, fetchHighVolumeSkusData, loadWeeklyProgress]);

  const startCycleCount = async () => {
    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
    const now = DateTime.now().setZone('UTC').toISO();
    try {
      const existingData = await fetchCycleCounts(cycleId, selectedLocation);
      const existingProgress = existingData ? existingData.progress || {} : {};
      const updatedProgress = { ...existingProgress, ...cycleProgress };

      await upsertCycleCounts({
        id: cycleId,
        start_date: existingData?.start_date || now,
        last_updated: now,
        progress: updatedProgress,
        completed: false,
        user_type: 'user',
        location: selectedLocation
      });

      setIsCounting(true);
      setCycleProgress(updatedProgress);
      setStatus('Started cycle count.');
      setStatusColor('green');

      if (selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')) {
        setWeeklyProgress({});
        const currentDay = DateTime.now().toFormat('EEEE');
        const weeklyId = `Weekly_${DateTime.now().toFormat('yyyy-MM-dd')}_HSTD_${currentDay}`;
        await upsertWeeklyCountsHstd({
          id: weeklyId,
          date: now,
          last_updated: now,
          progress: {},
          day: currentDay,
          location: 'HSTD',
          completed: false
        });
        await loadWeeklyProgress();
      }
    } catch (error) {
      setStatus(`Error starting cycle count: ${error.message}`);
      setStatusColor('red');
    }
  };

  const resetCycleCount = async () => {
    if (!window.confirm('Are you sure you want to reset the count?')) return;

    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
    const currentDay = DateTime.now().toFormat('EEEE');
    const weeklyId = `Weekly_${DateTime.now().toFormat('yyyy-MM-dd')}_HSTD_${currentDay}`;

    try {
      await deleteCycleCount(cycleId, selectedLocation);
      if (selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')) {
        await deleteWeeklyCount(weeklyId);
        setWeeklyProgress({});
      }

      setCycleProgress({});
      setCountSources({});
      setIsCounting(false);
      setStatus('Count has been reset.');
      setStatusColor('green');
      await fetchComponentsData();
      if (selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')) {
        await loadWeeklyProgress();
      }
    } catch (error) {
      setStatus(`Error resetting count: ${error.message}`);
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
      const componentsData = await fetchComponents();
      const component = componentsData.find(c => c.barcode === barcode);
      const enteredQuantity = parseInt(quantity, 10);
      const actualQuantity = component ? getLocationQuantity(component) : 0;

      if (actualQuantity !== enteredQuantity) {
        setStatus(`Quantity does not match. Expected: ${actualQuantity}, Entered: ${enteredQuantity}. Please recount.`);
        setStatusColor('red');
        setShowNextButton(true);
        return;
      }

      const now = DateTime.now().setZone('UTC');
      const timestamp = now.toISO();

      if (selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')) {
        const currentDay = now.toFormat('EEEE');
        const weeklyId = `Weekly_${now.toFormat('yyyy-MM-dd')}_HSTD_${currentDay}`;
        const weeklyData = await fetchWeeklyCountsHstd(weeklyId);

        let conflictFound = false;
        let conflictDay = '';
        let conflictQuantity = null;

        if (weeklyData && weeklyData.progress[barcode] !== undefined && weeklyData.progress[barcode] !== enteredQuantity) {
          conflictFound = true;
          conflictDay = weeklyData.day;
          conflictQuantity = weeklyData.progress[barcode];
        }

        if (conflictFound) {
          if (
            !window.confirm(
              `This SKU was previously counted with a quantity of ${conflictQuantity} on ${conflictDay} at ${selectedLocation}. Update to ${enteredQuantity}?`
            )
          ) {
            setStatus('Count not updated. Please recount if necessary.');
            setStatusColor('red');
            setShowNextButton(true);
            return;
          }
        }

        const newWeeklyProgress = { ...weeklyProgress, [barcode]: enteredQuantity };
        await upsertWeeklyCountsHstd({
          id: weeklyId,
          date: now.toISO(),
          progress: newWeeklyProgress,
          day: currentDay,
          location: 'HSTD',
          last_updated: now.toISO(),
          completed: Object.keys(newWeeklyProgress).length === highVolumeSkus.length
        });

        setWeeklyProgress(newWeeklyProgress);
        const source = `Counted on ${now.toFormat('MM/dd/yyyy')} at ${now.toFormat('hh:mm:ss a')} using Weekly Count at ${selectedLocation}`;
        await logCountAction(barcode, enteredQuantity, 'user', weeklyId, source, timestamp);
      } else {
        const weeklyData = await fetchWeeklyCountsHstd(selectedLocation);
        let conflictFound = false;
        let conflictDay = '';
        let conflictQuantity = null;

        if (weeklyData) {
          if (weeklyData.progress[barcode] !== undefined && weeklyData.progress[barcode] !== enteredQuantity) {
            conflictFound = true;
            conflictDay = weeklyData.day;
            conflictQuantity = weeklyData.progress[barcode];
          }
        }

        if (conflictFound) {
          if (
            !window.confirm(
              `This SKU was previously counted with a quantity of ${conflictQuantity} in the ${conflictDay} weekly count at ${selectedLocation}. Update to ${enteredQuantity}?`
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
          '3PL': '3pl_quantity'
        };
        const quantityField = quantityFieldMap[selectedLocation];
        console.log('handleScan - Selected Location:', selectedLocation, 'Quantity Field:', quantityField);

        if (!quantityField) {
          throw new Error(`Invalid location: ${selectedLocation}. Expected one of: MtD, FtP, HSTD, 3PL`);
        }

        const updates = { [quantityField]: enteredQuantity };
        if (!component) {
          updates.description = '';
          updates.total_quantity = enteredQuantity;
        } else {
          const currentQuantities = {
            mtd_quantity: component.mtd_quantity || 0,
            ftp_quantity: component.ftp_quantity || 0,
            hstd_quantity: component.hstd_quantity || 0,
            '3pl_quantity': component['3pl_quantity'] || 0,
            quarantine_quantity: component.quarantine_quantity || 0
          };
          currentQuantities[quantityField] = enteredQuantity;
          updates.total_quantity = Object.values(currentQuantities).reduce((sum, qty) => sum + qty, 0);
        }

        await updateComponent(barcode, updates);

        const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
        const newCycleProgress = { ...cycleProgress, [barcode]: enteredQuantity };

        const cycleData = await fetchCycleCounts(cycleId, selectedLocation);
        await upsertCycleCounts({
          id: cycleId,
          start_date: cycleData?.start_date || timestamp,
          last_updated: timestamp,
          progress: newCycleProgress,
          completed: Object.keys(newCycleProgress).length === components.length,
          user_type: 'user',
          location: selectedLocation
        });

        setCycleProgress(newCycleProgress);
        const source = `Counted on ${now.toFormat('MM/dd/yyyy')} at ${now.toFormat('hh:mm:ss a')} using Monthly Count at ${selectedLocation}`;
        await logCountAction(barcode, enteredQuantity, 'user', cycleId, source, timestamp);
      }

      const updatedSource = await getCountSource(barcode);
      setCountSources((prev) => ({ ...prev, [barcode]: updatedSource }));

      setStatus(`Counted ${barcode} successfully at ${selectedLocation}!`);
      setStatusColor('green');
      setShowNextButton(true);

      await fetchComponentsData();
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

  const fetchSkuHistory = async (sku) => {
    try {
      const startOfMonth = DateTime.now().startOf('month').toISO();
      const endOfMonth = DateTime.now().endOf('month').toISO();
      const data = await fetchCountHistory({
        sku,
        location: 'HSTD',
        timestamp: `gte.${startOfMonth} and lte.${endOfMonth}`
      });
      setSkuHistory({ [sku]: data });
      setSelectedSku(sku);
    } catch (error) {
      setStatus(`Error fetching history for ${sku}: ${error.message}`);
      setStatusColor('red');
    }
  };

  const handleDoubleClick = (sku) => {
    if (highVolumeSkus.includes(sku) && selectedLocation === 'HSTD') {
      fetchSkuHistory(sku);
    }
  };

  const clearSkuHistory = async () => {
    if (!selectedSku) return;

    const confirmed = window.confirm(
      `Are you sure you want to clear the scan history for ${selectedSku} for this month? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const startOfMonth = DateTime.now().startOf('month').toISO();
      const endOfMonth = DateTime.now().endOf('month').toISO();
      await deleteCountHistory(selectedSku, startOfMonth, endOfMonth, 'HSTD');
      setSkuHistory({ [selectedSku]: [] });
      setStatus(`Scan history for ${selectedSku} cleared successfully.`);
      setStatusColor('green');
    } catch (error) {
      setStatus(`Error clearing history for ${selectedSku}: ${error.message}`);
      setStatusColor('red');
    }
  };

  return (
    <div className="bg-curaleaf-light p-8 rounded-xl shadow-soft">
      <h2 className="text-2xl font-semibold text-curaleaf-dark mb-6 text-center">
        {selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')
          ? `Weekly Count - HSTD (${DateTime.now().toFormat('EEEE')})`
          : `User Count - ${selectedLocation}`}
      </h2>

      {!isCounting && (
        <div className="text-center mb-6">
          <button
            onClick={startCycleCount}
            className="bg-curaleaf-teal text-white p-3 rounded-lg hover:bg-curaleaf-accent transition-all w-full max-w-xs shadow-sm"
          >
            {Object.keys(cycleProgress).length > 0 || Object.keys(weeklyProgress).length > 0
              ? 'Resume Count'
              : 'Start Count'}
          </button>
        </div>
      )}

      {isCounting && (
        <>
          <div className="mb-6">
            <label className="block text-curaleaf-dark mb-2 font-medium">
              Progress: {selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')
                ? `${Object.keys(weeklyProgress).length}/${highVolumeSkus.length} SKUs Counted`
                : `${Object.keys(cycleProgress).length}/${components.length} SKUs Counted`}
            </label>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-curaleaf-teal h-4 rounded-full"
                style={{
                  width: `${
                    (selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')
                      ? Object.keys(weeklyProgress).length / (highVolumeSkus.length || 1)
                      : Object.keys(cycleProgress).length / (components.length || 1)) * 100
                  }%`
                }}
              ></div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-curaleaf-dark mb-2">SKUs to Count:</h3>
            <ul className="list-disc pl-5">
              {(selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')
                ? highVolumeSkus
                : showAllSkus ? components : components.slice(0, 5)
              ).map((item) => {
                const barcode = typeof item === 'string' ? item : item.barcode;
                return (
                  <li
                    key={barcode}
                    className={
                      (selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')
                        ? weeklyProgress[barcode]
                        : cycleProgress[barcode]) !== undefined
                        ? 'text-green-600 cursor-pointer'
                        : 'text-curaleaf-dark cursor-pointer'
                    }
                    onDoubleClick={() => handleDoubleClick(barcode)}
                    title={highVolumeSkus.includes(barcode) && selectedLocation === 'HSTD' ? 'Double-click to view scan history' : ''}
                  >
                    {barcode}
                    {(selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')
                      ? weeklyProgress[barcode]
                      : cycleProgress[barcode]) !== undefined && (
                      <span className="ml-2">
                        (Counted: {selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')
                          ? weeklyProgress[barcode]
                          : cycleProgress[barcode]})
                      </span>
                    )}
                    {countSources[barcode] && (
                      <span className="text-sm italic"> - {countSources[barcode]}</span>
                    )}
                    {highVolumeSkus.includes(barcode) && selectedLocation === 'HSTD' && (
                      <span className="ml-2 text-blue-500 text-sm">[High Volume]</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {components.length > 5 && !(selectedLocation === 'HSTD' && window.location.pathname.includes('weekly')) && (
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
              Reset Count
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

      {selectedSku && skuHistory[selectedSku] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium text-curaleaf-dark mb-4">Scan History for {selectedSku}</h3>
            {skuHistory[selectedSku].length > 0 ? (
              <ul className="list-disc pl-5 mb-4">
                {skuHistory[selectedSku].map((entry, idx) => (
                  <li key={idx} className="text-curaleaf-dark">
                    {DateTime.fromISO(entry.timestamp).toFormat('MM/dd/yyyy HH:mm:ss')} - Quantity: {entry.quantity}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-curaleaf-dark italic mb-4">No scans recorded this month.</p>
            )}
            <div className="flex justify-between">
              <button
                onClick={clearSkuHistory}
                className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-700 transition-all w-full max-w-xs mr-2"
              >
                Clear History
              </button>
              <button
                onClick={() => setSelectedSku(null)}
                className="bg-curaleaf-teal text-white p-2 rounded-lg hover:bg-curaleaf-accent transition-all w-full max-w-xs ml-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CountItems;