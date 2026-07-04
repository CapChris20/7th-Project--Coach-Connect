// Voice AI Server - Rebuilt from scratch
// Handles /api/ask, /api/transcribe, /api/speak endpoints
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Groq } = require('groq-sdk');
const axios = require('axios');
const FormData = require('form-data');

const app = express();

// CORS configuration
const allowedOrigins = [
  /^http:\/\/localhost/,
  /^http:\/\/127\.0\.0\.1/,
  /^https:\/\/coach-connect-.*\.vercel\.app$/,
  /^https:\/\/coach-connect-.*\.surge\.sh$/,
  'exp:\/\/.*',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

console.log('✅ Voice AI Server initialized');
console.log('🔑 API Keys check:');
console.log('   GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing');
console.log('   DEEPGRAM_API_KEY:', process.env.DEEPGRAM_API_KEY ? '✅ Set' : '❌ Missing');
console.log('   ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? '✅ Set' : '❌ Missing');

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// /api/ask - Groq chat completion
app.post('/api/ask', async (req, res) => {
  try {
    const { messages, userContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Build system prompt with user context
    let systemPrompt = `You are an expert AI fitness and nutrition coach. You only discuss fitness, exercise, workouts, nutrition, diet, and recovery. If asked about anything else respond: 'I'm your fitness coach — I can only help with fitness and nutrition. What would you like to work on today?' Keep responses concise and conversational — they will be spoken out loud.`;

    if (userContext) {
      systemPrompt += `\n\nHere is the user's data: ${JSON.stringify(userContext, null, 2)}`;
    }

    console.log('🤖 Processing /api/ask request');
    console.log('📝 Messages count:', messages.length);
    console.log('👤 User context provided:', !!userContext);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    console.log('✅ Groq response generated');

    res.json({ response });

  } catch (error) {
    console.error('❌ Error in /api/ask:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// /api/transcribe - Deepgram speech to text
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audio } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    console.log('🎤 Processing /api/transcribe request');

    const formData = new FormData();
    formData.append('audio', Buffer.from(audio, 'base64'), 'audio.webm');
    formData.append('model', 'nova-2');
    formData.append('language', 'en');
    formData.append('smart_format', 'true');

    const response = await axios.post(
      'https://api.deepgram.com/v1/listen',
      formData,
      {
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          ...formData.getHeaders(),
        },
        timeout: 30000,
      }
    );

    const transcript = response.data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    console.log('✅ Transcription completed:', transcript.length > 0 ? 'Success' : 'Empty');

    res.json({ transcript });

  } catch (error) {
    console.error('❌ Error in /api/transcribe:', error);
    res.status(500).json({ transcript: '' });
  }
});

// /api/speak - ElevenLabs text to speech
app.post('/api/speak', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('🔊 Processing /api/speak request');

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/turbo-v2',
      {
        text: text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
        },
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    const audioBase64 = Buffer.from(response.data).toString('base64');

    console.log('✅ TTS audio generated');

    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBase64);

  } catch (error) {
    console.error('❌ Error in /api/speak:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Voice AI Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
