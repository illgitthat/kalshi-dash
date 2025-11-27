'use client';

import React from 'react';
import { ProcessedData } from '@/utils/processData';
import Overview from './Overview';
import PnlChart from './PnlChart';
import TradeDirectionPie from './TradeDirectionPie';
import TradeSettlementPie from './TradeSettlementPie';
import RiskAdjustedReturns from './RiskAdjustedReturns';
import TradeList from './TradeList';

interface DashboardProps {
  data: ProcessedData;
  onClear: () => void;
}

export default function Dashboard({ data, onClear }: DashboardProps) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Trading Dashboard</h2>
        <button
          onClick={onClear}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Clear Data
        </button>
      </div>

      <Overview
        stats={data.basicStats}
        trades={data.trades}
        matchedTrades={data.matchedTrades}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">PnL Over Time</h3>
          <PnlChart trades={data.trades} />
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Risk Adjusted Returns</h3>
          <RiskAdjustedReturns matchedTrades={data.matchedTrades} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Trade Direction</h3>
          <div className="h-64 flex justify-center">
            <TradeDirectionPie
              yesCount={data.basicStats.yesNoBreakdown.Yes}
              noCount={data.basicStats.yesNoBreakdown.No}
            />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Trade Settlement</h3>
          <div className="h-64 flex justify-center">
            <TradeSettlementPie trades={data.trades} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">Recent Trades</h3>
        </div>
        <TradeList trades={data.matchedTrades} />
      </div>
    </div>
  );
}
