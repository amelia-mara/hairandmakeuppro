// Vercel Serverless Function - API Endpoint for AI calls
// This handles OpenAI API requests securely without exposing your API key

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, maxTokens = 500 } = req.body || {};
    
    if (!messages) {
      return res.status(400).json({ error: 'Missing messages array' });
    }

    // Get API key from environment variable (set in Vercel dashboard)
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",  // Using gpt-4o which is available
        temperature: 0.7,
        max_tokens: maxTokens,
        messages: messages
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API Error:', data);
      return res.status(response.status).json(data);
    }

    // Return the full response to the client
    res.status(200).json(data);
    
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      error: String(error?.message || error) 
    });
  }
}
