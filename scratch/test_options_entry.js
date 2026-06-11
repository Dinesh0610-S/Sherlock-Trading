const axios = require('axios');

(async () => {
  try {
    console.log('Querying options-entry for NIFTY...');
    const rNifty = await axios.post('http://localhost:3001/api/premarket/options-entry', { symbol: 'NIFTY' });
    console.log('NIFTY RESPONSE:');
    console.log({
      symbol: rNifty.data.symbol,
      spot: rNifty.data.spot,
      ceAction: rNifty.data.ce?.entry?.action,
      peAction: rNifty.data.pe?.entry?.action
    });

    console.log('\nQuerying options-entry for BANKNIFTY...');
    const rBankNifty = await axios.post('http://localhost:3001/api/premarket/options-entry', { symbol: 'BANKNIFTY' });
    console.log('BANKNIFTY RESPONSE:');
    console.log({
      symbol: rBankNifty.data.symbol,
      spot: rBankNifty.data.spot,
      ceAction: rBankNifty.data.ce?.entry?.action,
      peAction: rBankNifty.data.pe?.entry?.action
    });
  } catch (err) {
    console.error('Error during options-entry test:', err.message);
    if (err.response) {
      console.error(err.response.data);
    }
  }
})();
