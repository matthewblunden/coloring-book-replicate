// api/replicate-image-edit.js
const formidable = require('formidable');
const fs = require('fs');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  // ✅ CORS for production
  res.setHeader('Access-Control-Allow-Origin', 'https://mattsplayground.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      hasFilepath: !!file.filepath,
      hasPath: !!file.path,
      properties: Object.keys(file)
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

    // Call Replicate API
    const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'cc2012c1d4ef86c83e4ac3b73e4ca85be047aa3d2914b12a2cc9d70de42031e0',
        input: {
          image: `data:${mimeType};base64,${base64Image}`,
          prompt: 'children\'s coloring book line art, bold uniform black outlines, no shading, white background',
          scale: 9,
        },
      }),
    });

    const prediction = await replicateRes.json();

    if (!replicateRes.ok) {
      console.error('❌ Replicate API error:', prediction);
      return res.status(replicateRes.status).json({ 
        error: 'Replicate request failed', 
        details: prediction 
      });
    }

    console.log('✅ Prediction created:', prediction.id);
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
  },
};
