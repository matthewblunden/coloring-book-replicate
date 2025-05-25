// api/replicate-status.js
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get prediction ID from query params
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing prediction ID' });
  }

  try {
    // Check API token
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('❌ REPLICATE_API_TOKEN not found');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Call Replicate API to check status
    const replicateRes = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!replicateRes.ok) {
      const error = await replicateRes.text();
      console.error('❌ Replicate API error:', error);
      return res.status(replicateRes.status).json({ error: 'Failed to get prediction status' });
    }

    const prediction = await replicateRes.json();
    
    console.log(`📊 Prediction ${id} status: ${prediction.status}`);
    
    // Return the prediction data
    return res.status(200).json(prediction);
    
  } catch (err) {
    console.error('❌ Server error:', err);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
    });
  }
};
