// api/replicate-image-edit.js
const formidable = require('formidable');
const fs = require('fs');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  console.log(`📥 Received ${req.method} request to /api/replicate-image-edit`);
  
  // ✅ CORS for production
  res.setHeader('Access-Control-Allow-Origin', '*'); // Temporarily allow all origins for debugging
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling OPTIONS preflight request');
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== 'POST') {
    console.log(`❌ Method ${req.method} not allowed`);
    return res.status(405).json({ 
      error: 'Method not allowed',
      received: req.method,
      expected: 'POST'
    });
  }

  console.log('✅ Processing POST request');

  try {
    // Parse the form data
    const form = new formidable.IncomingForm();
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Form parse error:', err);
          reject(err);
        } else {
          resolve({ fields, files });
        }
      });
    });
    
    console.log('📂 Files received:', Object.keys(files));
    
    // Get the image file
    let file = files.image;
    
    // If it's an array, take the first one
    if (Array.isArray(file)) {
      file = file[0];
    }
    
    if (!file) {
      console.warn('⚠️ No image file uploaded');
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log('📂 File properties:', {
      originalFilename: file.originalFilename,
      mimetype: file.mimetype,
      size: file.size,
      filepath: file.filepath
    });

    // Get the file path
    const filePath = file.filepath || file.path;
    
    if (!filePath) {
      console.error('❌ File object:', JSON.stringify(file, null, 2));
      throw new Error('File path not found in uploaded file');
    }

    // Read file and convert to base64
    const buffer = await new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    
    const base64Image = buffer.toString('base64');
    
    // Determine mime type
    const mimeType = file.mimetype || file.type || 'image/jpeg';

    console.log('📤 Sending to Replicate...');

    // Make sure we have the API token
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('❌ REPLICATE_API_TOKEN not found in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Missing API token'
      });
    }

    // Call Replicate API
    const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
     // This uses the QR code model which is good at creating clean black/white patterns
body: JSON.stringify({
  version: "9cdabf8f8a991351960c7ce2105de2909514b9b2d8da70c7a3f1c42f2db7fa1b",
  input: {
    image: `data:${mimeType};base64,${base64Image}`,
    prompt: "coloring book page, simple black outline",
    qr_conditioning_scale: 2.0,
    num_inference_steps: 20,
    guidance_scale: 10,
    negative_prompt: "complex, realistic, detailed"
  }
}),
    });

    const prediction = await replicateRes.json();

    if (!replicateRes.ok) {
      console.error('❌ Replicate API error:', JSON.stringify(prediction, null, 2));
      return res.status(replicateRes.status).json({ 
        error: 'Replicate request failed', 
        details: prediction 
      });
    }

    console.log('✅ Prediction created:', prediction.id);
    console.log('📊 Prediction status:', prediction.status);
    console.log('🔗 Prediction URL:', prediction.urls?.get);
    
    return res.status(200).json(prediction);
    
  } catch (err) {
    console.error('❌ Server error:', err);
    console.error('Stack trace:', err.stack);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
