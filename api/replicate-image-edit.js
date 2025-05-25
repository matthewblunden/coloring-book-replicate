// api/replicate-poll.js
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://mattsplayground.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Prediction ID required' });
  }

  try {
    console.log(`📊 Polling prediction: ${id}`);
    
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Replicate poll error:', result);
      return res.status(response.status).json({ 
        error: 'Failed to get prediction', 
        details: result 
      });
    }
    
    console.log(`✅ Prediction ${id} status: ${result.status}`);
    
    // If completed and has output, log it
    if (result.status === 'succeeded' && result.output) {
      console.log(`🎨 Output URL: ${result.output[0]}`);
    }
    
    return res.status(200).json(result);
    
  } catch (err) {
    console.error('❌ Polling error:', err);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
    });
  }
};
