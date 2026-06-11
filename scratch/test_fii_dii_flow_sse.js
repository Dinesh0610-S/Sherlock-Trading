const http = require('http');

const postData = JSON.stringify({
  fii_buy: 1200.0,
  fii_sell: 2500.0,
  dii_buy: 3100.0,
  dii_sell: 1800.0,
  history: [
    { fii_net: 500.0, dii_net: -400.0 },
    { fii_net: 600.0, dii_net: 200.0 },
    { fii_net: -1200.0, dii_net: 100.0 },
    { fii_net: 1000.0, dii_net: -800.0 },
    { fii_net: 200.0, dii_net: -100.0 }
  ]
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/fii-dii/analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY CHUNK: \n${chunk}`);
  });
  res.on('end', () => {
    console.log('No more data in response.');
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(postData);
req.end();
