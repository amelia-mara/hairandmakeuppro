export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const { messages, maxTokens = 500, model = 'claude-sonnet-4-20250514' } = req.body || {};
        if (!messages) {
            return res.status(400).json({ error: 'Missing messages array' });
        }
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Anthropic API key not configured' });
        }
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.3, messages })
        });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: String(error?.message || error) });
    }
}
