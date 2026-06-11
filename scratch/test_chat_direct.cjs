const axios = require('axios');

(async () => {
  console.log('Testing http://localhost:3001/api/chat...');
  try {
    const res = await axios.post('http://localhost:3001/api/chat', {
      messages: [{ role: 'user', content: 'Hello' }],
      system: 'You are Sherlock Holmes.'
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
      // read data stream
      err.response.data.on('data', chunk => {
        process.stdout.write(chunk.toString());
      });
    } else {
      console.error('Error:', err.message);
    }
  }
})();
