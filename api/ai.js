// Vercel Serverless Function - API Endpoint for Claude AI calls
// This handles Anthropic Claude API requests securely without exposing your API key

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, maxTokens = 500, model = 'claude-sonnet-4-20250514' } = req.body || {};

    if (!messages) {
      return res.status(400).json({ error: 'Missing messages array' });
    }

    // Get API key from environment variable (set in Vercel dashboard)
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Anthropic API key not configured on server' });
    }

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        temperature: 0.3,
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API Error:', data);
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
