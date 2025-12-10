// Vercel Serverless Function - API Endpoint for Claude OCR
// This handles Claude API requests for receipt OCR securely

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, fileType, apiKey } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Use provided API key or fall back to environment variable
    const claudeApiKey = apiKey || process.env.CLAUDE_API_KEY;

    if (!claudeApiKey) {
      return res.status(400).json({ error: 'API key not provided. Please set your Claude API key in Settings.' });
    }

    // Extract base64 data if it's a data URL
    let base64Data = imageBase64;
    if (imageBase64.includes(',')) {
      base64Data = imageBase64.split(',')[1];
    }

    // Determine media type
    let mediaType = fileType || 'image/jpeg';
    if (mediaType === 'image/heic') mediaType = 'image/jpeg';

    const prompt = `Analyse this receipt/invoice image and extract the following data in JSON format:
{
  "supplier": "supplier name",
  "date": "DD/MM/YYYY",
  "invoice_number": "if visible",
  "items": [
    {
      "description": "item description",
      "quantity": 1,
      "amount": 0.00,
      "suggested_category": "one of: disposables, hygiene, makeup, hair, prosthetics, mouldmaking, sfxmakeup, accessories, actoressentials, departmentsupplies"
    }
  ],
  "total": 0.00
}

For suggested_category, use your knowledge of hair and makeup department supplies:
- disposables: mascara wands, cotton buds, sponges, gloves, applicators
- hygiene: brush cleaner, alcohol, sanitiser, wipes, sterilising supplies
- makeup: foundations, powders, lip products, mascara, setting spray, makeup brushes
- hair: wigs, extensions, styling products, combs, hairspray
- prosthetics: ready-made pieces, bondo moulds, transfers, bald caps, pre-made appliances
- mouldmaking: silicone, alginate, plaster, lifecasting supplies, release agents
- sfxmakeup: liquid latex, blood products, adhesives, removers, sealers, scar wax
- accessories: hair clips, grips, facial jewellery, piercings, decorative pieces
- actoressentials: chewing gum, mints, eye drops, tampons, deodorant, lip balm, tissues
- departmentsupplies: kit bags, capes, mirrors, organisers, storage, towels

Return ONLY the JSON object, no markdown formatting or explanation.`;

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API Error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Claude API request failed'
      });
    }

    // Extract and parse the JSON response
    const content = data.content?.[0]?.text;

    if (!content) {
      return res.status(500).json({ error: 'No content in Claude response' });
    }

    // Try to parse the JSON
    let ocrResult;
    try {
      ocrResult = JSON.parse(content);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        ocrResult = JSON.parse(jsonMatch[0]);
      } else {
        console.error('Could not parse OCR response:', content);
        return res.status(500).json({ error: 'Could not parse receipt data from AI response' });
      }
    }

    // Return the parsed OCR result
    res.status(200).json(ocrResult);

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      error: String(error?.message || error)
    });
  }
}
