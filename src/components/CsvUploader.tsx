'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { processCSVData, ProcessedData, combineProcessedData } from '@/utils/processData';
import Dashboard from './Dashboard';

interface CsvData {
  headers: string[];
  rows: any[];
  rowCount: number;
}

interface CsvUploaderProps {
  onFileUpload?: (data: ProcessedData) => void;
}

export default function CsvUploader({ onFileUpload }: CsvUploaderProps) {
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setError('');

    try {
      const processedDataArray: ProcessedData[] = [];

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Skip if file was already processed
        if (uploadedFiles.includes(file.name)) {
          continue;
        }

        const results = await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            complete: resolve,
            error: reject,
          });
        });

        try {
          const processed = processCSVData(results);
          processedDataArray.push(processed);
          setUploadedFiles(prev => [...prev, file.name]);
        } catch (err) {
          setError(prev => prev + `\nError processing ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (processedDataArray.length > 0) {
        // Combine all processed data
        const combinedData = processedDataArray.length === 1
          ? processedDataArray[0]
          : combineProcessedData(processedDataArray);

        setProcessedData(combinedData);
        if (onFileUpload) {
          onFileUpload(combinedData);
        }
      }
    } catch (err) {
      setError(prev => prev + `\nError parsing files: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const clearData = () => {
    setProcessedData(null);
    setError('');
    setUploadedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onFileUpload) {
      onFileUpload({
        originalData: [],
        trades: [],
        matchedTrades: [],
        basicStats: {
          uniqueTickers: 0,
          totalTrades: 0,
          yesNoBreakdown: { Yes: 0, No: 0 },
          totalFees: 0,
          totalProfit: 0,
          avgContractPurchasePrice: 0,
          avgContractFinalPrice: 0,
          weightedHoldingPeriod: 0,
          winRate: 0,
          settledWinRate: 0
        }
      });
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-6">Kalshi Performance Dashboard</h1>

      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Instructions</h2>
        <p className="mb-2">
          To analyze your trading history, download your transaction data from Kalshi:
        </p>
        <ol className="list-decimal pl-6 mb-4">
          <li>Log in to your Kalshi account</li>
          <li>Go to <a href="https://kalshi.com/account/taxes">Documents</a></li>
          <li>Download your transaction history CSV files (one for each year)</li>
          <li>Upload the CSV files below</li>
        </ol>
      </div>

      {processedData && !loading ? (
        <Dashboard data={processedData} onClear={clearData} />
      ) : (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white shadow-lg rounded-xl p-8 mb-8 border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Get Started</h2>
            <p className="text-gray-600 mb-4">
              To analyze your trading history, download your transaction data from Kalshi:
            </p>
            <ol className="list-decimal pl-6 mb-6 space-y-2 text-gray-600">
              <li>Log in to your Kalshi account</li>
              <li>Go to <a href="https://kalshi.com/account/taxes" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Documents</a></li>
              <li>Download your transaction history CSV files (one for each year)</li>
              <li>Upload the CSV files below</li>
            </ol>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Transaction CSV Files
              </label>
              <div className="flex flex-col gap-4">
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 transition-colors bg-gray-50 hover:bg-blue-50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    multiple
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="mt-1 text-sm text-gray-600">
                      <span className="font-medium text-blue-600 hover:text-blue-500">Upload a file</span> or drag and drop
                    </p>
                    <p className="mt-1 text-xs text-gray-500">CSV up to 10MB</p>
                  </div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Uploaded files:</p>
                    <ul className="space-y-1">
                      {uploadedFiles.map((file, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-700 font-medium">Processing data...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto mb-6 bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* GitHub link */}
      <div className="mt-12 text-center">
        <a
          href="https://github.com/jsteng19/kalshi-dash"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          View on GitHub
        </a>
      </div>
    </div>
  );
}
