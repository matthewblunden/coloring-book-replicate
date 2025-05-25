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
      body: JSON.stringify({
  version: "628e604a13cf63887dc8c5312a11602c1f5bdf472663e13c5a8b7889dff0d425",
  input: {
    image: `data:${mimeType};base64,${base64Image}`,
    prompt: "clean coloring book outline, bold black lines only, simple drawing for children",
    negative_prompt: "photo, realistic, complex, detailed, shading, gradients, colors",
    num_samples: 1,
    image_resolution: 512,
    scheduler: "K_EULER_ANCESTRAL",
    num_inference_steps: 30,
    guidance_scale: 15,
    seed: -1,
    eta: 0,
    controlnet_conditioning_scale: 1.5,
    control_guidance_start: 0,
    control_guidance_end: 1
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
