import axios from 'axios';

const NSE_BASE = 'https://www.nseindia.com';
const NSE_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer':         'https://www.nseindia.com/',
  'Origin':          'https://www.nseindia.com',
  'X-Requested-With': 'XMLHttpRequest',
  'Connection':      'keep-alive',
};

async function getCookies() {
  try {
    const resp = await axios.get(`${NSE_BASE}/api/allIndices`, {
      headers: { 'User-Agent': NSE_HEADERS['User-Agent'] },
      timeout: 8000,
    });
    const setCookies = resp.headers['set-cookie'];
    if (setCookies && setCookies.length) {
      return setCookies.map(c => c.split(';')[0]).join('; ');
    }
  } catch (err) {
    console.error('Session probe failed:', err.message);
  }
  return '';
}

async function test() {
  console.log('Fetching session cookie...');
  const cookie = await getCookies();
  console.log('Cookie obtained:', cookie ? 'YES' : 'NO');
  
  const headers = { ...NSE_HEADERS, Cookie: cookie };
  
  try {
    console.log('Testing fiiIndex...');
    const r = await axios.get(`${NSE_BASE}/api/fiiIndex`, { headers, timeout: 8000 });
    console.log('fiiIndex status:', r.status);
    console.log('fiiIndex sample data:', JSON.stringify(r.data).slice(0, 800));
  } catch (err) {
    console.error('fiiIndex error:', err.message);
  }
}

test();
