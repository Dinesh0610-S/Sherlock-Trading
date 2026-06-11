const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

const target = `    // Calculate confidence score using the rewritten formula
    const confidenceObj = calculatePreMarketConfidence({
      gapPct,
      pcr,
      fiiNet: fii.fii_net,
      vix,
      globalCues: {
        dow: morning.global.dow,
        nasdaq: morning.global.nasdaq,
      },
      preopenImbalance,
      newsSentiment,
      bias
    });`;

const replacement = `    // Calculate confidence score using the new weighted composite schema
    const confidenceObj = calculatePreMarketConfidence({
      gapPct,
      preopenImbalance,
      bias,
      totalPreopenQty: scan?.total_preopen_qty ?? 65000,
      gappingStocksCount: bias === 'CE' ? (scan?.gap_ups?.length ?? 12) : (scan?.gap_downs?.length ?? 12),
      iepStability: scan?.iep_stability !== undefined ? scan.iep_stability : true,
      premiumAligned: bias === 'CE' ? (gapPct > 0) : (gapPct < 0),
      volVsAvgRatio: scan?.vol_vs_avg_ratio ?? 1.25
    });`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated confidence call in server.js');
} else {
  console.warn('Target string not found in server.js. It may have already been replaced.');
}
