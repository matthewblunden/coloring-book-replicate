// api/replicate-image-edit.js
const formidable = require('formidable');
const { readFile } = require('fs/promises');
const fetch = require('node-fetch');

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
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
    const form = formidable({ multiples: false });
    
    const [fields, files] = await form.parse(req);
    
    console.log('📂 Files received:', files);
    
    // Get the first file from the image field
    const file = files.image?.[0] || files.image;
    
    if (!file) {
      console.warn('⚠️ No image file uploaded');
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log('📂 File details:', {
      originalFilename: file.originalFilename,
      mimetype: file.mimetype,
      filepath: file.filepath,
      size: file.size
    });

    // Read file and convert to base64
    const buffer = await readFile(file.filepath);
    const base64Image = buffer.toString('base64');
    
    // Determine mime type for data URL
    const mimeType = file.mimetype || 'image/jpeg';

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
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
    });
  }
}
