async function testModels() {
  const key = "AQ.Ab8RN6J-vrknMa1UTNEXDQLNiQYAukB7a7mGsZqN9quLIJq9mQ";
  const models = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-flash-latest'
  ];

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const payload = {
      contents: [{ parts: [{ text: "Hello, reply in one word." }] }]
    };

    try {
      console.log(`Testing model: ${model}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✓ ${model} Success! Response:`, JSON.stringify(data.candidates?.[0]?.content?.parts?.[0]?.text));
        return; // found a working one!
      } else {
        const err = await response.text();
        console.log(`✗ ${model} Failed: ${response.status}`, err);
      }
    } catch (e) {
      console.error(`Error testing ${model}:`, e.message);
    }
  }
}

testModels();
