import { parse } from 'papaparse';
import { toDate } from 'date-fns-tz';

export interface Trade {
  Ticker: string;
  Type: string;
  Direction: string;
  Contracts: number;
  Average_Price: number;
  Realized_Revenue: number;
  Realized_Cost: number;
  Realized_Profit: number;
  Fees: number;
  Created: string;
  Date: Date;
  Trade_Cost: number;
}

export interface MatchedTrade {
  Ticker: string;
  Entry_Date: Date;
  Exit_Date: Date;
  Entry_Direction: string;
  Exit_Type: string;
  Contracts: number;
  Entry_Cost: number;
  Realized_Profit: number;
  Net_Profit: number;
  Holding_Period_Days: number;
  ROI?: number;
  Entry_Fee: number;
  Exit_Fee: number;
  Total_Fees: number;
  Entry_Price: number;
  Exit_Price: number;
}

interface Position {
  ticker: string;
  direction: string;
  contracts: number;
  avg_price: number;
  entry_date: Date;
  entry_fee: number;
  cost: number;
  is_closed: boolean;
}

export interface ProcessedData {
  originalData: any[];
  trades: Trade[];
  matchedTrades: MatchedTrade[];
  basicStats: {
    uniqueTickers: number;
    totalTrades: number;
    yesNoBreakdown: { Yes: number; No: number };
    totalFees: number;
    totalProfit: number;
    avgContractPurchasePrice: number;
    avgContractFinalPrice: number;
    weightedHoldingPeriod: number;
    winRate: number;
    settledWinRate: number;
  };
}

const LEGACY_COLUMNS = ['ticker', 'type', 'direction', 'contracts', 'average_price', 'created'];
const NEW_FORMAT_COLUMNS = [
  'market_ticker',
  'quantity',
  'side',
  'entry_price_cents',
  'exit_price_cents',
  'realized_pnl_with_fees_cents'
];

const normalizeHeader = (header?: string) => header?.trim().toLowerCase() ?? '';
const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};
const centsToDollars = (value: unknown): number => parseNumber(value) / 100;
const normalizeDirection = (direction?: string) => {
  if (!direction) return 'Unknown';
  const lower = direction.toLowerCase();
  if (lower === 'yes' || lower === 'y') return 'Yes';
  if (lower === 'no' || lower === 'n') return 'No';
  return direction;
};

// Parse date by converting Kalshi format to standard format for date-fns-tz
const parseDate = (dateStr: string): Date => {
  try {
    // Check if it's the Kalshi format: "Jan 20, 2025 at 10:04 AM PST"
    const kalshiPattern = /(\w+ \d+, \d+) at (\d+:\d+) ?([AP]M) ([A-Z]{2,4})/i;
    const kalshiMatch = dateStr.match(kalshiPattern);

    if (kalshiMatch) {
      // Timezone mapping to UTC offsets
      const timezoneOffsets: Record<string, string> = {
        'PST': '-08:00', 'PDT': '-07:00', 'PT': '-08:00',
        'MST': '-07:00', 'MDT': '-06:00', 'MT': '-07:00',
        'CST': '-06:00', 'CDT': '-05:00', 'CT': '-06:00',
        'EST': '-05:00', 'EDT': '-04:00', 'ET': '-05:00',
        'AKST': '-09:00', 'AKDT': '-08:00', 'AKT': '-09:00',
        'HST': '-10:00', 'HDT': '-09:00', 'HT': '-10:00',
        'AST': '-04:00', 'ADT': '-03:00', 'AT': '-04:00',
        'UTC': '+00:00', 'GMT': '+00:00', 'Z': '+00:00'
      };

      const [, dateStr, timeStr, ampm, timeZone] = kalshiMatch;
      const upperTimeZone = timeZone.toUpperCase();
      const offset = timezoneOffsets[upperTimeZone] || '-08:00'; // Default to PST

      const dateMatch = dateStr.match(/(\w+) (\d+), (\d+)/);
      if (dateMatch) {
        const [, monthName, day, year] = dateMatch;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.indexOf(monthName);

        if (monthIndex !== -1) {
          const month = String(monthIndex + 1).padStart(2, '0');
          const dayPadded = day.padStart(2, '0');

          // Parse time: "10:04" + "AM" -> "10:04:00"
          const [hours, minutes] = timeStr.split(':');
          let hour24 = parseInt(hours);

          if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
            hour24 += 12;
          } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
            hour24 = 0;
          }

          const hourPadded = String(hour24).padStart(2, '0');

          // Create ISO format: "2025-01-20T10:04:00-10:00"
          const isoFormat = `${year}-${month}-${dayPadded}T${hourPadded}:${minutes}:00${offset}`;

          // Use date-fns-tz to parse the ISO format
          const parsed = toDate(isoFormat);
          if (!isNaN(parsed.getTime())) {
            return parsed;
          }
        }
      }
    }


    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }

    console.error("Failed to parse date:", dateStr);
    return new Date(); // Return current date as fallback
  } catch (error) {
    console.error("Error parsing date:", dateStr, error);
    return new Date(); // Return current date as fallback
  }
};

const transformNewFormatRows = (rows: any[]): { trades: Trade[]; matchedTrades: MatchedTrade[] } => {
  const trades: Trade[] = [];
  const matchedTrades: MatchedTrade[] = [];

  rows.forEach((row, index) => {
    if (!row) return;

    const rawType = (row.type || row.Type || '').toString().toLowerCase();
    if (rawType === 'credit') return;

    const ticker = row.market_ticker || row.Ticker;
    if (!ticker) return;

    const contracts = parseNumber(row.quantity || row.Contracts);
    if (contracts <= 0) return;

    const entryPriceCents = parseNumber(row.entry_price_cents || row.Entry_Price);
    const exitPriceCents = parseNumber(row.exit_price_cents || row.Exit_Price);
    const openFees = centsToDollars(row.open_fees_cents || row.Open_Fees);
    const closeFees = centsToDollars(row.close_fees_cents || row.Close_Fees);
    const pnlWithoutFees = centsToDollars(row.realized_pnl_without_fees_cents || row.Realized_PnL_Without_Fees);
    const pnlWithFees = centsToDollars(row.realized_pnl_with_fees_cents || row.Realized_PnL_With_Fees);

    const direction = normalizeDirection(row.side || row.Direction);
    const entryTimestamp = row.open_timestamp || row.entry_timestamp || row.opened_at || row.created_at || row.Created;
    const exitTimestamp = row.close_timestamp || row.exit_timestamp || row.closed_at || row.updated_at || row.Updated || row.Closed;

    const entryDate = entryTimestamp ? parseDate(entryTimestamp) : new Date(Date.now() - (rows.length - index) * 1000);
    const exitDate = exitTimestamp ? parseDate(exitTimestamp) : entryDate;

    const entryCost = contracts * (entryPriceCents / 100);
    const exitProceeds = contracts * (exitPriceCents / 100);
    const totalFees = openFees + closeFees;

    const isSettlement = exitPriceCents === 0 || exitPriceCents === 100 || rawType === 'settlement';
    const tradeType = isSettlement ? 'settlement' : 'trade';

    trades.push({
      Ticker: ticker,
      Type: tradeType,
      Direction: direction,
      Contracts: contracts,
      Average_Price: entryPriceCents,
      Realized_Revenue: exitProceeds,
      Realized_Cost: entryCost,
      Realized_Profit: pnlWithFees,
      Fees: totalFees,
      Created: (exitTimestamp || entryTimestamp || exitDate.toISOString()),
      Date: exitDate,
      Trade_Cost: entryCost,
    });

    matchedTrades.push({
      Ticker: ticker,
      Entry_Date: entryDate,
      Exit_Date: exitDate,
      Entry_Direction: direction,
      Exit_Type: tradeType,
      Contracts: contracts,
      Entry_Cost: entryCost,
      Realized_Profit: pnlWithoutFees,
      Net_Profit: pnlWithFees,
      Holding_Period_Days: (exitDate.getTime() - entryDate.getTime()) / (24 * 3600 * 1000),
      ROI: entryCost !== 0 ? pnlWithFees / entryCost : undefined,
      Entry_Fee: openFees,
      Exit_Fee: closeFees,
      Total_Fees: totalFees,
      Entry_Price: entryPriceCents,
      Exit_Price: exitPriceCents,
    });
  });

  return { trades, matchedTrades };
};

// Calculate trade cost based on row data
const calculateTradeCost = (row: Trade): number => {
  if (row.Type === 'settlement' || (row.Type === 'trade' && row.Realized_Profit !== 0)) {
    // For settlements or trades with realized P&L, use the realized cost
    return Math.abs(row.Realized_Cost);
  } else if (row.Type === 'trade' && row.Realized_Profit === 0) {
    // For initial trades (buying position), use Average_Price
    const price = row.Average_Price / 100; // Convert cents to dollars
    return row.Contracts * price;
  }
  return 0;
};

// Match trades using FIFO method
const matchTradesFifo = (trades: Trade[]): MatchedTrade[] => {
  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) => a.Date.getTime() - b.Date.getTime());

  // Calculate proper trade costs
  sortedTrades.forEach(trade => {
    trade.Trade_Cost = calculateTradeCost(trade);
  });

  // Dictionary to store open positions for each ticker
  const openPositions: Record<string, Position[]> = {};
  const completedTrades: MatchedTrade[] = [];

  // Debug counters
  let entryCount = 0;
  let exitCount = 0;
  let unmatchedExits = 0;

  for (const trade of sortedTrades) {
    const ticker = trade.Ticker;
    const direction = trade.Direction;

    // Initialize position list if needed
    if (!openPositions[ticker]) {
      openPositions[ticker] = [];
    }

    if (trade.Type === 'trade' && trade.Realized_Profit === 0) {
      // Entry trade
      entryCount++;
      const position: Position = {
        ticker,
        direction,
        contracts: trade.Contracts,
        avg_price: trade.Average_Price,
        entry_date: trade.Date,
        entry_fee: trade.Fees || 0,
        cost: trade.Trade_Cost,
        is_closed: false
      };

      // Add as new position
      openPositions[ticker].push(position);

    } else if (trade.Type === 'settlement' || (trade.Type === 'trade' && trade.Realized_Profit !== 0)) {
      // Exit trade
      exitCount++;
      let contractsToClose = trade.Contracts;

      // Calculate exit price based on trade type
      let exitPrice: number;
      if (trade.Type === 'settlement') {
        // For settlements, exit price is Realized_Revenue / Contracts
        exitPrice = trade.Realized_Revenue / contractsToClose * 100; // Convert to cents
      } else {
        // For exit trades, use the Average_Price
        exitPrice = trade.Average_Price;
      }

      const realizedProfitPerContract = trade.Realized_Profit !== 0 ? trade.Realized_Profit / contractsToClose : 0;
      const exitFee = trade.Fees || 0;

      // Find matching open positions
      const matchingPositions = openPositions[ticker]?.filter(p =>
        !p.is_closed &&
        (p.direction === direction ||
        (p.direction === 'Yes' && direction === 'No') ||
        (p.direction === 'No' && direction === 'Yes'))
      );

      if (!matchingPositions || matchingPositions.length === 0) {
        unmatchedExits++;
        console.warn(`Warning: Exit without matching entry found for ${ticker} (${direction}) on ${trade.Date}`);
        continue;
      }

      // Match with oldest positions first (FIFO)
      for (const position of matchingPositions) {
        if (contractsToClose <= 0) break;

        const contractsClosed = Math.min(contractsToClose, position.contracts);

        // Calculate proportional profit and costs
        let profit: number;
        let finalExitPrice: number;

        if (trade.Type === 'settlement') {
          profit = realizedProfitPerContract * contractsClosed;
          finalExitPrice = exitPrice;
        } else {
          // For opposite direction trades, calculate profit based on price difference
          (position.direction !== direction)
          const entryPrice = position.avg_price;
          finalExitPrice = 100 - exitPrice; // Effective sell price
          profit = contractsClosed * (100 - entryPrice - exitPrice) / 100;
        }

        const entryCost = position.cost * (contractsClosed / position.contracts);

        // Calculate proportional fees
        const proportionalEntryFee = position.entry_fee * (contractsClosed / position.contracts);
        const proportionalExitFee = exitFee * (contractsClosed / contractsToClose);
        const totalFees = proportionalEntryFee + proportionalExitFee;

        const matchedTrade: MatchedTrade = {
          Ticker: position.ticker,
          Entry_Date: position.entry_date,
          Exit_Date: trade.Date,
          Entry_Direction: position.direction,
          Exit_Type: trade.Type,
          Contracts: contractsClosed,
          Entry_Cost: entryCost,
          Realized_Profit: profit,
          Net_Profit: profit - totalFees,
          Holding_Period_Days: (trade.Date.getTime() - position.entry_date.getTime()) / (24 * 3600 * 1000),
          ROI: (profit - totalFees) / entryCost,
          Entry_Fee: proportionalEntryFee,
          Exit_Fee: proportionalExitFee,
          Total_Fees: totalFees,
          Entry_Price: position.avg_price,
          Exit_Price: finalExitPrice
        };

        completedTrades.push(matchedTrade);

        // Update position
        contractsToClose -= contractsClosed;
        position.contracts -= contractsClosed;
        if (position.contracts <= 0) {
          position.is_closed = true;
        }
      }
    }
  }

  // Clean up closed positions
  for (const ticker in openPositions) {
    openPositions[ticker] = openPositions[ticker].filter(p => !p.is_closed);
  }

  console.log("Matching Statistics:");
  console.log(`Entry trades processed: ${entryCount}`);
  console.log(`Exit trades processed: ${exitCount}`);
  console.log(`Unmatched exits: ${unmatchedExits}`);
  console.log(`Open positions remaining: ${Object.values(openPositions).reduce((sum, pos) => sum + pos.length, 0)}`);

  return completedTrades;
};

// Calculate basic statistics
const calculateBasicStats = (trades: Trade[], matchedTrades: MatchedTrade[]) => {
  const uniqueTickers = new Set(trades.map(t => t.Ticker)).size;

  const yesNoBreakdown = trades.reduce((acc, trade) => {
    const dir = normalizeDirection(trade.Direction);
    if (dir === 'Yes' || dir === 'No') {
      acc[dir] = (acc[dir] || 0) + trade.Contracts;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalFees = trades.reduce((sum, trade) => sum + (trade.Fees || 0), 0);
  const totalProfit = trades.reduce((sum, trade) => sum + (trade.Realized_Profit || 0), 0);

  const totalContracts = matchedTrades.reduce((sum, trade) => sum + trade.Contracts, 0);
  const avgContractPurchasePrice = totalContracts > 0
    ? matchedTrades.reduce((sum, trade) => sum + trade.Entry_Price * trade.Contracts, 0) / totalContracts
    : 0;
  const avgContractFinalPrice = totalContracts > 0
    ? matchedTrades.reduce((sum, trade) => sum + trade.Exit_Price * trade.Contracts, 0) / totalContracts
    : 0;

  const totalTradeValue = matchedTrades.reduce((sum, trade) => sum + trade.Entry_Cost, 0);
  const weightedHoldingPeriod = totalTradeValue > 0
    ? matchedTrades.reduce((sum, trade) => sum + (trade.Holding_Period_Days * (trade.Entry_Cost / totalTradeValue)), 0)
    : 0;

  const winRate = matchedTrades.length > 0
    ? matchedTrades.filter(trade => trade.Net_Profit > 0).length / matchedTrades.length
    : 0;
  const settledTrades = matchedTrades.filter(trade => trade.Exit_Type === 'settlement');
  const settledWinRate = settledTrades.length > 0
    ? settledTrades.filter(trade => trade.Net_Profit > 0).length / settledTrades.length
    : 0;

  return {
    uniqueTickers,
    totalTrades: trades.length,
    yesNoBreakdown: {
      Yes: yesNoBreakdown['Yes'] || 0,
      No: yesNoBreakdown['No'] || 0,
    },
    totalFees,
    totalProfit,
    avgContractPurchasePrice,
    avgContractFinalPrice,
    weightedHoldingPeriod,
    winRate,
    settledWinRate,
  };
};

// Main processing function
export const processCSVData = (results: any): ProcessedData => {
  try {
    if (!results.data || !Array.isArray(results.data) || results.data.length === 0) {
      throw new Error('Invalid CSV format: No data found');
    }

    const headers = (results.meta?.fields || []).map(normalizeHeader);
    const hasLegacyColumns = LEGACY_COLUMNS.every(col => headers.includes(col));
    const hasNewColumns = NEW_FORMAT_COLUMNS.every(col => headers.includes(col));

    if (!hasLegacyColumns && !hasNewColumns) {
      throw new Error(
        'Invalid CSV format: Missing required columns for both legacy and new Kalshi exports.'
      );
    }

    const rawData = results.data as any[];

    if (hasNewColumns && !hasLegacyColumns) {
      const { trades, matchedTrades } = transformNewFormatRows(rawData);
      if (trades.length === 0) {
        throw new Error('No valid trades found in the CSV file');
      }

      const basicStats = calculateBasicStats(trades, matchedTrades);
      return {
        originalData: rawData,
        trades,
        matchedTrades,
        basicStats,
      };
    }

    const trades: Trade[] = rawData
      .filter(row => row && row.Ticker && row.Type !== 'credit')
      .map(row => {
        try {
          const cleanMoney = (val: string) => {
            if (!val) return 0;
            return parseFloat(val.replace('$', '').trim()) || 0;
          };

          const trade: Trade = {
            Ticker: row.Ticker,
            Type: row.Type,
            Direction: row.Direction,
            Contracts: parseFloat(row.Contracts) || 0,
            Average_Price: parseFloat(row.Average_Price) || 0,
            Realized_Revenue: cleanMoney(row.Realized_Revenue),
            Realized_Cost: cleanMoney(row.Realized_Cost),
            Realized_Profit: cleanMoney(row.Realized_Profit),
            Fees: row.Fees ? cleanMoney(row.Fees) : 0,
            Created: row.Created,
            Date: parseDate(row.Created),
            Trade_Cost: 0,
          };

          return trade;
        } catch (error) {
          console.error('Error processing row:', row, error);
          return null;
        }
      })
      .filter(Boolean) as Trade[];

    if (trades.length === 0) {
      throw new Error('No valid trades found in the CSV file');
    }

    const matchedTrades = matchTradesFifo(trades);
    const basicStats = calculateBasicStats(trades, matchedTrades);

    return {
      originalData: rawData,
      trades,
      matchedTrades,
      basicStats,
    };
  } catch (error) {
    console.error('Error processing CSV data:', error);
    throw error;
  }
};

// Combine multiple ProcessedData objects into one
export const combineProcessedData = (dataArray: ProcessedData[]): ProcessedData => {
  // Combine all trades
  const allTrades = dataArray.reduce<Trade[]>((acc, data) => [...acc, ...data.trades], []);

  // Sort all trades by date
  const sortedTrades = allTrades.sort((a, b) => a.Date.getTime() - b.Date.getTime());

  // Match trades using FIFO across all data
  const matchedTrades = matchTradesFifo(sortedTrades);

  // Calculate combined stats
  const basicStats = calculateBasicStats(sortedTrades, matchedTrades);

  // Combine original data
  const originalData = dataArray.reduce<any[]>((acc, data) => [...acc, ...data.originalData], []);

  return {
    originalData,
    trades: sortedTrades,
    matchedTrades,
    basicStats,
  };
};

// Test function for timezone parsing (can be called from console for debugging)
export const testTimezoneParsing = () => {
  const testDates = [
    // Kalshi format with various timezones
    'Jan 20, 2025 at 10:04 AM HST',
    'Jan 20, 2025 at 10:04 AM PST',
    'Jan 20, 2025 at 10:04 AM EST',
    'Jan 20, 2025 at 2:30 PM CST',
    'Jan 20, 2025 at 11:45 PM MST',

    // Variations in formatting
    'Jan 20, 2025 at 10:04AM HST', // No space before AM
    'Feb 5, 2025 at 10:04 pm pst', // Lowercase

    // ISO formats that date-fns-tz should handle directly
    '2025-01-20T10:04:00-10:00', // HST offset
    '2025-01-20T10:04:00-08:00', // PST offset
    '2025-01-20T10:04:00-05:00', // EST offset
  ];

  console.log('Testing timezone parsing (Kalshi format -> ISO -> date-fns-tz):');
  testDates.forEach(dateStr => {
    const parsed = parseDate(dateStr);
    const isValid = !isNaN(parsed.getTime());
    console.log(`${dateStr.padEnd(35)} -> ${parsed.toISOString()} (${isValid ? 'VALID' : 'INVALID'})`);
  });
};
