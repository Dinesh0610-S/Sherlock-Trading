const axios = require('axios');

async function testNSEChart() {
  try {
    const url = 'http://localhost:3001/api/nse/quote?symbol=NIFTY';
    console.log('Testing connection to proxy for live quote...');
    const quoteResp = await axios.get(url);
    console.log('Quote response status:', quoteResp.status);
    console.log('Quote data keys:', Object.keys(quoteResp.data));
    console.log('Last Price:', quoteResp.data.lastPrice);
  } catch (err) {
    console.error('Error fetching live quote from proxy:', err.message);
  }
}

testNSEChart();
