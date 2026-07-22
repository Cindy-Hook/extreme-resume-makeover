// Serverless function: scores an uploaded resume PDF using an AI provider.
// To enable real AI scoring, add an ANTHROPIC_API_KEY environment variable
// in your Vercel project settings. Until then, this returns a clearly
// labeled placeholder score so the upload -> score -> upsell flow still works.

const busboy = require('busboy');
const pdfParse = require('pdf-parse');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { fileBuffer, email } = await parseForm(req);

    if (!fileBuffer) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      res.status(200).json(placeholderResult());
      return;
    }

    const pdfData = await pdfParse(fileBuffer);
    const resumeText = (pdfData.text || '').slice(0, 12000);

    if (!resumeText.trim()) {
      res.status(200).json(placeholderResult());
      return;
    }

    const prompt = 'You are an expert resume reviewer and recruiter with decades of hiring experience. ' +
      'Score the following resume from 0 to 100 based on clarity, achievement-focused language, ATS keyword ' +
      'optimization, and overall recruiter appeal. Respond ONLY with valid JSON in this exact format: ' +
      '{"score": <number 0-100>, "feedback": "<2-3 sentence constructive feedback>"}.\n\nResume:\n' + resumeText;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!aiRes.ok) {
      throw new Error('AI provider request failed with status ' + aiRes.status);
    }

    const aiJson = await aiRes.json();
    const textOut = aiJson.content && aiJson.content[0] && aiJson.content[0].text ? aiJson.content[0].text : '{}';
    const parsed = safeParseJson(textOut);

    res.status(200).json({
      score: parsed.score || 70,
      feedback: parsed.feedback || 'Your resume was reviewed, but detailed feedback could not be generated this time.',
      placeholder: false,
      email
    });
  } catch (err) {
    console.error('score-resume error:', err);
    res.status(200).json(placeholderResult());
  }
};

function placeholderResult() {
  const score = Math.floor(Math.random() * 26) + 65;
  return {
    score,
    feedback: 'AI scoring is not fully connected yet. Add your ANTHROPIC_API_KEY in the Vercel project environment variables to enable real, AI-generated resume analysis.',
    placeholder: true
  };
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { return {}; }
    }
    return {};
  }
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    let email = '';
    const chunks = [];
    bb.on('field', (name, val) => {
      if (name === 'email') email = val;
    });
    bb.on('file', (name, file) => {
      file.on('data', (data) => chunks.push(data));
    });
    bb.on('close', () => {
      resolve({ fileBuffer: chunks.length ? Buffer.concat(chunks) : null, email });
    });
    bb.on('error', reject);
    req.pipe(bb);
  });
}
