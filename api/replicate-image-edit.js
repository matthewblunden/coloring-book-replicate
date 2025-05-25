// api/replicate-image-edit.js
import formidable from 'formidable';
import { readFile } from 'fs/promises';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mattsplayground.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new formidable.IncomingForm({ multiples: false });
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files?.image;
    if (!file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const buffer = await readFile(file.filepath);
    const base64Image = buffer.toString('base64');

    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'cc2012c1d4ef86c83e4ac3b73e4ca85be047aa3d2914b12a2cc9d70de42031e0', // ControlNet Canny SDXL
        input: {
          image: `data:image/jpeg;base64,${base64Image}`,
          prompt: 'children\u2019s coloring book line art, bold uniform black outlines, no shading, white background',
          scale: 9,
        },
      }),
    });

    const prediction = await replicateResponse.json();

    if (!replicateResponse.ok) {
      return res.status(replicateResponse.status).json({ error: 'Replicate request failed', details: prediction });
    }

    return res.status(200).json(prediction);
  } catch (err) {
    console.error('❌ Server error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
