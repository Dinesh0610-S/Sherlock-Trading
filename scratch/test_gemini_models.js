const apiKey = "AQ.Ab8RN6J-vrknMa1UTNEXDQLNiQYAukB7a7mGsZqN9quLIJq9mQ";

const models = [
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-3.5-flash"
];

(async () => {
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`Testing model: ${model}...`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: "Hello" }] }]
        })
      });
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Success! Response: ${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}`);
      } else {
        const text = await res.text();
        console.log(`Error: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`Fetch error: ${err.message}`);
    }
    console.log('-----------------------------------');
  }
})();
