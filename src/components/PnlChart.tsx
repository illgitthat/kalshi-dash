'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  ChartOptions
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { enUS } from 'date-fns/locale';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface PnlChartProps {
  trades: any[];
}

export default function PnlChart({ trades }: PnlChartProps) {
  const [viewMode, setViewMode] = useState<'cumulative' | 'daily'>('cumulative');

  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return null;

    // Sort trades by date
    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime()
    );

    if (viewMode === 'cumulative') {
      let cumulativePnl = 0;
      const dataPoints = sortedTrades.map(trade => {
        cumulativePnl += trade.Realized_Profit;
        return {
          x: new Date(trade.Date),
          y: cumulativePnl
        };
      });

      // Add start point
      if (dataPoints.length > 0) {
        const firstDate = new Date(dataPoints[0].x);
        firstDate.setDate(firstDate.getDate() - 1);
        dataPoints.unshift({ x: firstDate, y: 0 });
      }

      return {
        datasets: [
          {
            label: 'Cumulative PnL',
            data: dataPoints,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            tension: 0.1,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      };
    } else {
      // Group by day
      const dailyPnl = new Map<string, number>();

      sortedTrades.forEach(trade => {
        const dateStr = new Date(trade.Date).toISOString().split('T')[0];
        const current = dailyPnl.get(dateStr) || 0;
        dailyPnl.set(dateStr, current + trade.Realized_Profit);
      });

      const sortedDates = Array.from(dailyPnl.keys()).sort();
      const dataPoints = sortedDates.map(date => ({
        x: new Date(date),
        y: dailyPnl.get(date) || 0
      }));

      return {
        datasets: [
          {
            label: 'Daily PnL',
            data: dataPoints,
            backgroundColor: dataPoints.map(d => d.y >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)'),
            borderColor: dataPoints.map(d => d.y >= 0 ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)'),
            borderWidth: 1,
          },
        ],
      };
    }
  }, [trades, viewMode]);

  const options: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(context.parsed.y);
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          displayFormats: {
            day: 'MMM d',
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        ticks: {
          callback: (value: any) => {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(value);
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
    },
  };

  if (!chartData) return null;

  return (
    <div className="h-[300px] w-full flex flex-col">
      <div className="flex justify-end mb-4 space-x-2">
        <button
          onClick={() => setViewMode('cumulative')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            viewMode === 'cumulative'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Cumulative
        </button>
        <button
          onClick={() => setViewMode('daily')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            viewMode === 'daily'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Daily
        </button>
      </div>
      <div className="flex-1 relative">
        {viewMode === 'cumulative' ? (
          <Line data={chartData} options={options} />
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
