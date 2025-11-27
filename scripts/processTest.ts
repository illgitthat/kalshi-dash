import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { processCSVData } from '../src/utils/processData';

const csvPath = path.join(process.cwd(), 'data', 'Kalshi-Transactions-2025.csv');
const csv = fs.readFileSync(csvPath, 'utf8');
const results = Papa.parse(csv, { header: true, skipEmptyLines: true });

try {
  const processed = processCSVData(results);
  console.log('trades', processed.trades.length);
  console.log('matched', processed.matchedTrades.length);
} catch (err) {
  console.error('processing failed', err);
  if (err instanceof Error) {
    console.error('message', err.message);
  }
}
