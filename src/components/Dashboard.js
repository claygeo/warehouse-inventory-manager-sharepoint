import React, { useState, useEffect, useRef, useCallback } from 'react';
import supabase from '../utils/supabaseClient';
import { DateTime } from 'luxon';
import { Line, Bar, Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-luxon';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  MatrixController,
  MatrixElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const Dashboard = ({ selectedLocation }) => {
  const [progressOverTimeData, setProgressOverTimeData] = useState(null);
  const [topSkusData, setTopSkusData] = useState(null);
  const [mostScannedByLocationData, setMostScannedByLocationData] = useState(null);
  const [weeklyTrendsData, setWeeklyTrendsData] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('');
  const [selectedGraph, setSelectedGraph] = useState('progressOverTime');
  const chartRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
        fetchProgressOverTime(),
        fetchTopSkus(),
        fetchMostScannedByLocation(),
        fetchWeeklyTrends(),
      ]);
    } catch (error) {
      setStatus(`Error loading dashboard data: ${error.message}`);
      setStatusColor('red');
    }
  }, [fetchProgressOverTime, fetchTopSkus, fetchMostScannedByLocation, fetchWeeklyTrends]);

  const fetchProgressOverTime = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('count_history')
        .select('timestamp')
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const countsByDate = {};
      data.forEach((entry) => {
        const date = DateTime.fromISO(entry.timestamp).toFormat('yyyy-MM-dd');
        countsByDate[date] = (countsByDate[date] || 0) + 1;
      });

      let cumulativeCount = 0;
      const chartData = Object.entries(countsByDate).map(([date, count]) => {
        cumulativeCount += count;
        return { x: DateTime.fromFormat(date, 'yyyy-MM-dd').toJSDate(), y: cumulativeCount };
      });

      setProgressOverTimeData({
        datasets: [
          {
            label: 'Total Items Scanned',
            data: chartData,
            borderColor: '#00A6A6',
            backgroundColor: 'rgba(0, 166, 166, 0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      });
    } catch (error) {
      console.error('Error fetching progress over time:', error.message);
    }
  }, []);

  const fetchTopSkus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('count_history')
        .select('sku');

      if (error) throw error;

      const skuCounts = {};
      data.forEach((entry) => {
        skuCounts[entry.sku] = (skuCounts[entry.sku] || 0) + 1;
      });

      const sortedSkus = Object.entries(skuCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      setTopSkusData({
        labels: sortedSkus.map(([sku]) => sku),
        datasets: [
          {
            label: 'Times Scanned',
            data: sortedSkus.map(([, count]) => count),
            backgroundColor: '#FF6B6B',
            borderColor: '#D94F4F',
            borderWidth: 1,
            hoverBackgroundColor: '#FF8787',
          },
        ],
      });
    } catch (error) {
      console.error('Error fetching top SKUs:', error.message);
    }
  }, []);

  const fetchMostScannedByLocation = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('count_history')
        .select('sku, location');

      if (error) throw error;

      if (!data || data.length === 0) {
        setMostScannedByLocationData(null);
        return;
      }

      const locations = ['MtD', 'FtP', 'HSTD', '3PL'];
      const skuLocationCounts = {};

      data.forEach((entry) => {
        if (!skuLocationCounts[entry.sku]) {
          skuLocationCounts[entry.sku] = {};
        }
        skuLocationCounts[entry.sku][entry.location] = (skuLocationCounts[entry.sku][entry.location] || 0) + 1;
      });

      const topSkus = Object.entries(skuLocationCounts)
        .sort((a, b) => {
          const totalA = Object.values(a[1]).reduce((sum, val) => sum + (val || 0), 0);
          const totalB = Object.values(b[1]).reduce((sum, val) => sum + (val || 0), 0);
          return totalB - totalA;
        })
        .slice(0, 10)
        .map(([sku]) => sku);

      const heatmapData = topSkus.map((sku, skuIndex) =>
        locations.map((loc, locIndex) => ({
          x: locIndex,
          y: skuIndex,
          v: skuLocationCounts[sku][loc] || 0,
        }))
      ).flat();

      setMostScannedByLocationData({
        datasets: [
          {
            label: 'Scan Frequency',
            data: heatmapData,
            backgroundColor: (ctx) => {
              const value = ctx.raw.v;
              const maxValue = Math.max(...heatmapData.map((d) => d.v), 1);
              const alpha = value / maxValue;
              return `rgba(255, 107, 107, ${alpha})`;
            },
            borderColor: '#D94F4F',
            borderWidth: 1,
            width: ({ chart }) => (chart.chartArea?.width || 0) / locations.length * 0.9,
            height: ({ chart }) => (chart.chartArea?.height || 0) / topSkus.length * 0.9,
          },
        ],
        labels: {
          x: locations,
          y: topSkus,
        },
      });
    } catch (error) {
      console.error('Error fetching most scanned by location:', error.message);
      setMostScannedByLocationData(null);
    }
  }, []);

  const fetchWeeklyTrends = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_counts_hstd')
        .select('progress, day, last_updated')
        .eq('location', selectedLocation);

      if (error) throw error;

      if (!data || data.length === 0) {
        setWeeklyTrendsData(null);
        setWeeks([]);
        return;
      }

      const countsByDayAndWeek = {};
      data.forEach((entry) => {
        const dt = DateTime.fromISO(entry.last_updated);
        const dayOfWeek = dt.weekday;
        const weekNumber = dt.weekNumber;
        const key = `${weekNumber}-${dayOfWeek}`;
        countsByDayAndWeek[key] = Object.keys(entry.progress || {}).length;
      });

      const weeksData = [...new Set(data.map((entry) => DateTime.fromISO(entry.last_updated).weekNumber))].sort().slice(-4);
      setWeeks(weeksData);
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const heatmapData = weeksData.map((week, weekIndex) =>
        days.map((day, dayIndex) => {
          const key = `${week}-${dayIndex + 1}`;
          return {
            x: dayIndex,
            y: weekIndex,
            v: countsByDayAndWeek[key] || 0,
          };
        })
      ).flat();

      setWeeklyTrendsData({
        datasets: [
          {
            label: `Scans Per Day (${selectedLocation})`,
            data: heatmapData,
            backgroundColor: (ctx) => {
              const value = ctx.raw.v;
              const maxValue = Math.max(...heatmapData.map((d) => d.v), 1);
              const alpha = value / maxValue;
              return `rgba(0, 166, 166, ${alpha})`;
            },
            borderColor: '#007A7A',
            borderWidth: 1,
            width: ({ chart }) => (chart.chartArea?.width || 0) / days.length * 0.9,
            height: ({ chart }) => (chart.chartArea?.height || 0) / weeksData.length * 0.9,
          },
        ],
      });
    } catch (error) {
      console.error('Error fetching weekly trends:', error.message);
      setWeeklyTrendsData(null);
      setWeeks([]);
    }
  }, [selectedLocation]);

  useEffect(() => {
    fetchData();

    const subscription = supabase
      .channel('count-history-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'count_history' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [selectedLocation, fetchData]);

  const graphOptions = {
    progressOverTime: {
      type: 'line',
      data: progressOverTimeData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Items Scanned Over Time',
            font: { size: 24, family: 'Arial', weight: 'bold' },
            color: '#333',
          },
          legend: { position: 'top', labels: { font: { size: 16 } } },
          tooltip: {
            callbacks: {
              label: (context) => `Scanned: ${context.parsed.y} items on ${DateTime.fromJSDate(context.parsed.x).toFormat('MMM dd, yyyy')}`,
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'day', displayFormats: { day: 'MMM dd' } },
            title: { display: true, text: 'Date', font: { size: 18 } },
            ticks: { font: { size: 14 } },
          },
          y: {
            title: { display: true, text: 'Total Items', font: { size: 18 } },
            ticks: { font: { size: 14 } },
            beginAtZero: true,
          },
        },
      },
    },
    topSkus: {
      type: 'bar',
      data: topSkusData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Most Frequently Scanned Items',
            font: { size: 24, family: 'Arial', weight: 'bold' },
            color: '#333',
          },
          legend: { position: 'top', labels: { font: { size: 16 } } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: Scanned ${context.parsed.y} times`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Item Code', font: { size: 18 } },
            ticks: { font: { size: 14 }, maxRotation: 45, minRotation: 45 },
          },
          y: {
            title: { display: true, text: 'Times Scanned', font: { size: 18 } },
            ticks: { font: { size: 14 } },
            beginAtZero: true,
          },
        },
      },
    },
    mostScannedByLocation: {
      type: 'matrix',
      data: mostScannedByLocationData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Top Items by Location (Heatmap)',
            font: { size: 24, family: 'Arial', weight: 'bold' },
            color: '#333',
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const sku = mostScannedByLocationData?.labels.y[context.raw.y] || 'Unknown';
                const location = mostScannedByLocationData?.labels.x[context.raw.x] || 'Unknown';
                return `${sku} at ${location}: ${context.raw.v} scans`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            labels: ['MtD', 'FtP', 'HSTD', '3PL'],
            title: { display: true, text: 'Location', font: { size: 18 } },
            ticks: { font: { size: 14 } },
          },
          y: {
            type: 'category',
            labels: mostScannedByLocationData ? mostScannedByLocationData.labels.y : [],
            title: { display: true, text: 'Item Code', font: { size: 18 } },
            ticks: { font: { size: 14 } },
          },
        },
      },
    },
    weeklyTrends: {
      type: 'matrix',
      data: weeklyTrendsData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Weekly Scan Trends (${selectedLocation})`,
            font: { size: 24, family: 'Arial', weight: 'bold' },
            color: '#333',
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][context.raw.x];
                const week = weeks[context.raw.y] || 'Unknown';
                return `${day}, Week ${week}: ${context.raw.v} scans`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            title: { display: true, text: 'Day of Week', font: { size: 18 } },
            ticks: { font: { size: 14 } },
          },
          y: {
            type: 'category',
            labels: weeks.map((week) => `Week ${week}`),
            title: { display: true, text: 'Week', font: { size: 18 } },
            ticks: { font: { size: 14 } },
          },
        },
      },
    },
  };

  const graphMenu = [
    { id: 'progressOverTime', label: 'Progress Over Time (Line)' },
    { id: 'topSkus', label: 'Top SKUs (Bar)' },
    { id: 'mostScannedByLocation', label: 'Top Items by Location (Heatmap)' },
    { id: 'weeklyTrends', label: 'Weekly Trends (Heatmap)' },
  ];

  const renderChart = () => {
    const { type, data, options } = graphOptions[selectedGraph];
    if (!data) {
      return <p className="text-center text-curaleaf-dark">No data available for this graph.</p>;
    }

    switch (type) {
      case 'line':
        return <Line ref={chartRef} data={data} options={options} />;
      case 'bar':
        return <Bar ref={chartRef} data={data} options={options} />;
      case 'matrix':
        return <Chart ref={chartRef} type="matrix" data={data} options={options} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-curaleaf-light min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-curaleaf-dark mb-8 text-center">Inventory Dashboard</h2>

        {status && (
          <p className={`mb-6 text-center italic ${statusColor === 'red' ? 'text-red-500' : 'text-curaleaf-dark'}`}>
            {status}
          </p>
        )}

        <div className="mb-8 flex justify-center space-x-4">
          {graphMenu.map((graph) => (
            <button
              key={graph.id}
              onClick={() => setSelectedGraph(graph.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedGraph === graph.id
                  ? 'bg-curaleaf-teal text-white'
                  : 'bg-white text-curaleaf-dark hover:bg-curaleaf-accent hover:text-white'
              }`}
            >
              {graph.label}
            </button>
          ))}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md" style={{ height: '70vh' }}>
          {renderChart()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;