const axios = require('axios');

async function testNSEChartAPI() {
  try {
    // We can't import server.js directly easily, but we can query the proxy
    // to see if we can fetch raw data or write a test script that mimics nseGet.
    // Let's create a dummy server.js request since we have nseGet function in server.js.
    // Wait, let's see if we can make a query directly to NSE from this script.
    // To make requests to NSE, we need a session. Let's try to fetch it.
    console.log('Sending test request to NSE Chart API via a clean session...');
    
    // 1. Initialize session by hitting main page
    const sessionResp = await axios.get('https://www.nseindia.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    const cookies = sessionResp.headers['set-cookie'] || [];
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
    
    // 2. Fetch index chart data
    const chartUrl = 'https://www.nseindia.com/api/chart-databyindex?index=NIFTY%2050&preopen=true';
    const chartResp = await axios.get(chartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/get-quotes/derivatives?symbol=NIFTY',
        'Cookie': cookieHeader
      }
    });
    
    console.log('Success! Status:', chartResp.status);
    console.log('Keys in chart response:', Object.keys(chartResp.data));
    if (chartResp.data.grapthData) {
      console.log('Number of data points:', chartResp.data.grapthData.length);
      console.log('First data point:', chartResp.data.grapthData[0]);
      console.log('Last data point:', chartResp.data.grapthData[chartResp.data.grapthData.length - 1]);
    }
  } catch (err) {
    console.error('Error fetching from NSE Chart API:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
    }
  }
}

testNSEChartAPI();
