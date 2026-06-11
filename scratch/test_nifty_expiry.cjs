const axios = require('axios');

(async () => {
  console.log('Testing Nifty 50 expiry query...');
  try {
    const res = await axios.post('http://localhost:3001/api/chat', {
      messages: [{ role: 'user', content: 'when nifty50 expiry?' }],
      system: 'You are Holmes — an elite AI trading and investing assistant specialized exclusively in Indian financial markets.\nRULE 8 — OPTIONS EXPIRY DAYS:\n- Nifty 50 weekly options expire every Tuesday (not Thursday).\n- Sensex weekly options expire every Thursday.\n- If a weekly expiry day falls on a market holiday, the expiry shifts to the preceding trading day.\n- Monthly contracts expire on the last Tuesday of every month for Nifty 50, and the last Thursday of every month for Sensex.\n- Always state these specific days (Tuesday for Nifty, Thursday for Sensex) when answering expiry-related questions.'
    }, {
      responseType: 'stream'
    });

    console.log('Status:', res.status);
    console.log('Response stream:');
    res.data.on('data', chunk => {
      process.stdout.write(chunk.toString());
    });
    res.data.on('end', () => {
      console.log('\nStream finished.');
    });
  } catch (err) {
    if (err.response) {
      console.error('Error status:', err.response.status);
      err.response.data.on('data', chunk => {
        process.stdout.write(chunk.toString());
      });
    } else {
      console.error('Error:', err.message);
    }
  }
})();
