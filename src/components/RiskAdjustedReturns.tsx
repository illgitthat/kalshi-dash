'use client';

import React, { useState } from 'react';
import { MatchedTrade } from '@/utils/processData';

interface RiskAdjustedReturnsProps {
  matchedTrades: MatchedTrade[];
}

interface RiskMetrics {
  totalReturn: number;
  standardDeviation: number;
  annualizedSharpe: number;
  tradingDays: number;
  avgDailyReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  initialCapital: number;
}

const calculateRiskMetrics = (matchedTrades: MatchedTrade[], initialCapital: number): RiskMetrics => {
  if (matchedTrades.length === 0 || initialCapital <= 0) {
    return {
      totalReturn: 0,
      standardDeviation: 0,
      annualizedSharpe: 0,
      tradingDays: 0,
      avgDailyReturn: 0,
      annualizedReturn: 0,
      annualizedVolatility: 0,
      initialCapital,
    };
  }

  // Get date range
  const startDate = new Date(Math.min(...matchedTrades.map(t => t.Entry_Date.getTime())));
  const endDate = new Date(Math.max(...matchedTrades.map(t => t.Exit_Date.getTime())));

  // Create daily portfolio value tracking
  const portfolioValues: { [key: string]: number } = {};
  const dateRange: Date[] = [];
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dateRange.push(new Date(currentDate));
    portfolioValues[dateKey] = initialCapital; // Start with initial capital
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Apply P&L on exit dates using portfolio value approach
  let cumulativeProfit = 0;
  matchedTrades
    .sort((a, b) => a.Exit_Date.getTime() - b.Exit_Date.getTime())
    .forEach(trade => {
      const exitDateKey = new Date(trade.Exit_Date).toISOString().split('T')[0];
      cumulativeProfit += trade.Realized_Profit;

      // Update portfolio value from exit date onwards
      let updateDate = new Date(trade.Exit_Date);
      updateDate.setHours(0, 0, 0, 0);

      while (updateDate <= endDate) {
        const updateDateKey = updateDate.toISOString().split('T')[0];
        if (portfolioValues.hasOwnProperty(updateDateKey)) {
          portfolioValues[updateDateKey] = initialCapital + cumulativeProfit;
        }
        updateDate.setDate(updateDate.getDate() + 1);
      }
    });

  // Calculate daily returns from portfolio values
  const dailyReturns: number[] = [];
  const portfolioValueArray = dateRange.map(date => ({
    date,
    value: portfolioValues[date.toISOString().split('T')[0]]
  }));

  for (let i = 1; i < portfolioValueArray.length; i++) {
    const todayValue = portfolioValueArray[i].value;
    const yesterdayValue = portfolioValueArray[i - 1].value;

    if (yesterdayValue > 0) {
      const dailyReturn = (todayValue - yesterdayValue) / yesterdayValue;
      dailyReturns.push(dailyReturn);
    }
  }

  // Filter to only days with non-zero returns (trading activity)
  const activeDailyReturns = dailyReturns.filter(ret => Math.abs(ret) > 0);

  if (activeDailyReturns.length === 0) {
    return {
      totalReturn: 0,
      standardDeviation: 0,
      annualizedSharpe: 0,
      tradingDays: 0,
      avgDailyReturn: 0,
      annualizedReturn: 0,
      annualizedVolatility: 0,
      initialCapital,
    };
  }

  // Calculate metrics using all daily returns (including zero-return days)
  const avgDailyReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;

  // Calculate standard deviation using all daily returns
  const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgDailyReturn, 2), 0) / dailyReturns.length;
  const standardDeviation = Math.sqrt(variance);

  // Calculate total return from initial to final portfolio value
  const finalValue = portfolioValueArray[portfolioValueArray.length - 1].value;
  const totalReturn = (finalValue - initialCapital) / initialCapital;

  // Calculate trading period metrics for annualization
  const tradingDays = activeDailyReturns.length;
  const totalDays = dailyReturns.length;
  const expectedYearlyTradingDays = 252; // Standard trading days per year

  // Annualize metrics
  const annualizedReturn = avgDailyReturn * expectedYearlyTradingDays;
  const annualizedVolatility = standardDeviation * Math.sqrt(expectedYearlyTradingDays);

  // Calculate Sharpe ratio
  const excessReturn = avgDailyReturn;
  const sharpeRatio = standardDeviation !== 0 ? excessReturn / standardDeviation : 0;
  const annualizedSharpe = sharpeRatio * Math.sqrt(expectedYearlyTradingDays);

  return {
    totalReturn,
    standardDeviation,
    annualizedSharpe,
    tradingDays,
    avgDailyReturn,
    annualizedReturn,
    annualizedVolatility,
    initialCapital,
  };
};

export default function RiskAdjustedReturns({ matchedTrades }: RiskAdjustedReturnsProps) {
  const [totalCapital, setTotalCapital] = useState<number>(10000);
  const metrics = calculateRiskMetrics(matchedTrades, totalCapital);

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 4) => {
    return value.toFixed(decimals);
  };

  return (
    <div className="space-y-6">
      {/* Capital Input */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <label htmlFor="totalCapital" className="block text-sm font-medium text-gray-700 mb-2">
          Total Account Capital
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
          <input
            id="totalCapital"
            type="number"
            value={totalCapital}
            onChange={(e) => setTotalCapital(Number(e.target.value) || 0)}
            className="pl-8 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="10000"
            min="1"
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Metrics are calculated based on daily portfolio value changes relative to this initial capital.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Return */}
        <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className={`text-2xl font-bold ${metrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercent(metrics.totalReturn)}
          </div>
          <div className="text-sm text-gray-600 mt-1">Total Return</div>
        </div>

        {/* Standard Deviation */}
        <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="text-2xl font-bold text-blue-600">
            {formatPercent(metrics.standardDeviation)}
          </div>
          <div className="text-sm text-gray-600 mt-1">Daily Volatility</div>
        </div>

        {/* Annualized Sharpe Ratio */}
        <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className={`text-2xl font-bold ${metrics.annualizedSharpe >= 1 ? 'text-green-600' : metrics.annualizedSharpe >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
            {formatNumber(metrics.annualizedSharpe, 2)}
          </div>
          <div className="text-sm text-gray-600 mt-1">Sharpe Ratio</div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="pt-4 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Trading Days</span>
            <span className="font-medium text-gray-900">{metrics.tradingDays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Avg Daily Return</span>
            <span className="font-medium text-gray-900">{formatPercent(metrics.avgDailyReturn)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Ann. Return</span>
            <span className="font-medium text-gray-900">{formatPercent(metrics.annualizedReturn)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Ann. Volatility</span>
            <span className="font-medium text-gray-900">{formatPercent(metrics.annualizedVolatility)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
