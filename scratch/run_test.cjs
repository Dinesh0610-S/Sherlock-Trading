const axios = require('axios');

(async () => {
  try {
    const res = await axios.get('http://localhost:3001/api/premarket/scan');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
})();
