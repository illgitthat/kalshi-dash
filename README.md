# Kalshi Dashboard

A performance tracker for Kalshi traders that helps visualize PNL over time and analyse trading statistics

## Project Overview

This dashboard allows Kalshi traders to:
- Upload transaction CSV files from their Kalshi account
- Visualize profit/loss over time
- Analyze trading statistics
- See breakdowns by trade direction (Yes/No) and settlement types
- Track performance metrics for better trading decisions

All processing happens client-side, so your data remains private.

## Planned Features

- Interest earned
- More useful stats like max drawdown, variance, Sharpe, etc
- Drill-down feature to filter stats and PNL plot by different categories, trade direction, etc
- Plot of distribution of returns
- Position sizing analysis

## Technologies

- Next.js 16
- React 19 with TypeScript
- Tailwind CSS v4
- Chart.js (for data visualization)
- Papa Parse (for CSV parsing)

## Project Structure

- `/src/app` - Next.js App Router files
- `/src/components` - React components
- `/src/utils` - Data processing utilities
- `/public` - Static assets

## Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/jsteng19/kalshi-dash.git
   cd kalshi-dash
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Download your transaction CSV files from Kalshi (from the [Documents](https://kalshi.com/account/taxes) section in the Desktop site). Supports both legacy and new 2025 export formats.
2. Upload the files
3. View your trading analytics and performance metrics

## Deployment

The project is deployed on Github Pages. You can access the live version at:
[https://jsteng19.github.io/kalshi-dash/](https://jsteng19.github.io/kalshi-dash/)
