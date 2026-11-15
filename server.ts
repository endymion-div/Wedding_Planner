import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import { requireAuth, optionalAuth, type AuthRequest } from './src/middleware/auth.ts';
import { updateUserRole } from './src/db/users.ts';
import {
  getWeddingBootstrap,
  insertBatchPhotos,
  togglePhotoLike,
  insertStory,
  insertMilestone,
  insertGuest,
  updateGuestRecord,
  insertExpense,
  toggleExpensePaidRecord,
  upsertAppSetting,
  insertStudioCreation,
} from './src/db/weddingRepo.ts';
import { extractGroundingLinks } from './src/utils/imageUpload.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize server-side Gemini SDK client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function hasConfiguredGeminiKey(): boolean {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.length > 10);
}

// ==========================================
// AUTHENTICATION & USER PROFILE ROUTES
// ==========================================
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json({
      uid: req.user?.uid,
      email: req.user?.email,
      name: req.user?.name || req.user?.email?.split('@')[0] || 'Guest',
      picture: req.user?.picture || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to verify profile' });
  }
});

app.patch('/api/auth/role', requireAuth, async (req: AuthRequest, res) => {
  try {
    const role = req.body?.role === 'Couple' ? 'Couple' : 'Guest';
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const updated = await updateUserRole(req.user.uid, role);
    return res.json({ user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update role' });
  }
});

// ==========================================
// CLOUD SQL WEDDING DATA ROUTES
// ==========================================
app.get('/api/wedding-data', async (_req, res) => {
  try {
    const data = await getWeddingBootstrap();
    return res.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/wedding-data:', error);
    return res.status(500).json({ error: error.message || 'Failed to load wedding data' });
  }
});

app.post('/api/photos/batch', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required' });
    }
    const sanitized = items.slice(0, 30).map((item: any, idx: number) => ({
      id: String(item.id || `p-${Date.now()}-${idx}`),
      uploaderName: String(item.uploaderName || req.user?.name || 'Wedding Guest'),
      uploaderRole: item.uploaderRole === 'Couple' ? 'Couple' : 'Guest',
      uploaderUid: req.user?.uid || null,
      imageUrl: String(item.imageUrl || ''),
      caption: String(item.caption || 'Shared wedding memory'),
      timestampLabel: String(item.timestampLabel || 'Just now'),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : ['Candid'],
    })).filter((p: any) => p.imageUrl.length > 0);

    if (sanitized.length === 0) {
      return res.status(400).json({ error: 'No valid image payloads provided' });
    }

    const saved = await insertBatchPhotos(sanitized);
    return res.status(201).json({ photos: saved });
  } catch (error: any) {
    console.error('Error in POST /api/photos/batch:', error);
    return res.status(500).json({ error: error.message || 'Failed to save photos' });
  }
});

app.post('/api/photos/:id/like', async (req, res) => {
  try {
    const updated = await togglePhotoLike(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Photo not found' });
    return res.json({ photo: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update like' });
  }
});

app.post('/api/stories', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const story = req.body;
    if (!story?.id || !story?.mediaUrl) {
      return res.status(400).json({ error: 'Invalid story payload' });
    }
    const saved = await insertStory(story);
    return res.status(201).json({ story: saved });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to publish story' });
  }
});

app.post('/api/milestones', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const milestone = req.body;
    if (!milestone?.id || !milestone?.title) {
      return res.status(400).json({ error: 'Milestone title is required' });
    }
    const saved = await insertMilestone(milestone);
    return res.status(201).json({ milestone: saved });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to add milestone' });
  }
});

app.post('/api/guests', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guest = req.body;
    if (!guest?.id || !guest?.name || !guest?.email) {
      return res.status(400).json({ error: 'Guest name and email are required' });
    }
    const saved = await insertGuest(guest);
    return res.status(201).json({ guest: saved });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to add guest' });
  }
});

app.patch('/api/guests/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { status, plusOneName, dietary, tableNumber } = req.body;
    const patch: Record<string, any> = {
      updatedAt: new Date().toISOString().split('T')[0],
    };
    if (status !== undefined) patch.status = status;
    if (plusOneName !== undefined) patch.plusOneName = plusOneName;
    if (dietary !== undefined) patch.dietary = dietary;
    if (tableNumber !== undefined) patch.tableNumber = Number(tableNumber);

    const updated = await updateGuestRecord(req.params.id, patch);
    if (!updated) return res.status(404).json({ error: 'Guest not found' });
    return res.json({ guest: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update guest' });
  }
});

app.post('/api/expenses', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const expense = req.body;
    if (!expense?.id || !expense?.title) {
      return res.status(400).json({ error: 'Expense title is required' });
    }
    const saved = await insertExpense(expense);
    return res.status(201).json({ expense: saved });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to add expense' });
  }
});

app.patch('/api/expenses/:id/toggle-paid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const updated = await toggleExpensePaidRecord(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Expense not found' });
    return res.json({ expense: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update expense' });
  }
});

app.put('/api/settings/budget', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const totalBudget = Number(req.body?.totalBudget);
    if (!Number.isFinite(totalBudget) || totalBudget < 0) {
      return res.status(400).json({ error: 'Valid budget amount required' });
    }
    await upsertAppSetting('totalBudget', String(Math.round(totalBudget)));
    return res.json({ totalBudget: Math.round(totalBudget) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update budget' });
  }
});

app.put('/api/settings/vows', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const vowsExcerpt = String(req.body?.vowsExcerpt || '').trim();
    if (!vowsExcerpt) {
      return res.status(400).json({ error: 'Vows text is required' });
    }
    await upsertAppSetting('vowsExcerpt', vowsExcerpt);
    return res.json({ vowsExcerpt });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save vows' });
  }
});

// ==========================================
// GEMINI AI ASSISTANT (MULTI-TURN + SEARCH + MAPS GROUNDING)
// ==========================================
app.post('/api/assistant', async (req, res) => {
  try {
    const {
      message,
      history = [],
      role = 'Guest',
      weddingContext,
      modelTier = 'general',
      groundingMode = 'none',
      userLocation,
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const contextPrompt = `
You are "EverAfter Concierge", an elegant, helpful, and charming AI Wedding Assistant for Elena & Julian's wedding celebration.
Current user role talking to you: ${role} (${role === 'Couple' ? 'Bride/Groom with full administrative access' : 'Attending Guest'}).

Current Wedding Live Context:
- Couple: Elena Vance & Julian Hayes
- Date: Saturday, September 18, 2027 at 4:30 PM CET
- Venue: Villa La Selva Estate, Tuscany, Italy (Strada di Selva 14, 53019 Castelnuovo Berardenga, Siena)
- Venue Coordinates: 43.3486, 11.4921
- Dress Code: Black Tie Optional / Tuscan Garden Chic (Ladies: Floor-length gowns or refined cocktail dresses; Gentlemen: Tuxedo or dark suit & tie. Block heels recommended for the garden gravel).
- Parking & Shuttles: Complimentary valet at the North Gate. Private shuttles depart Florence Grand Hotel at 3:15 PM and 3:45 PM. Return shuttles run every 45 min from 11:00 PM to 2:30 AM.
- Children Policy: Adults-only ceremony and reception (infants in arms welcome).
- Live RSVP Stats: ${weddingContext?.rsvpStats ? JSON.stringify(weddingContext.rsvpStats) : '142 Invited, 98 Confirmed, 28 Pending, 16 Declined'}
- Live Budget Stats: ${weddingContext?.budgetStats ? JSON.stringify(weddingContext.budgetStats) : 'Total Budget $75,000 | Spent $52,400 | Remaining $22,600'}
- Upcoming Vendor Due: Catering final installment ($6,800 due Aug 15).

Guidelines:
1. Tone: Warm, refined, conversational, and deeply helpful.
2. When Google Search or Google Maps grounding is active, provide real, accurate recommendations and places near Villa La Selva / Siena / Florence, formatted in clean Markdown.
3. If the user asks about live data (RSVP counts, remaining budget, vendor dues), pull exact numbers from Live Stats above.
4. Keep responses concise and well-structured.
`;

    if (!hasConfiguredGeminiKey()) {
      return res.json({
        reply: getFallbackAnswer(message, role, weddingContext),
        source: 'EverAfter Wedding Concierge',
        groundingLinks: [],
      });
    }

    // Model routing per task type
    let model = 'gemini-4-hydrogen';
    if (groundingMode === 'maps' || groundingMode === 'search') {
      model = 'gemini-4-hydrogen';
    } else if (modelTier === 'fast') {
      model = 'gemini-3.1-flash-lite';
    } else if (modelTier === 'complex') {
      model = 'gemini-4-argon';
    } else if (modelTier === 'deep') {
      model = 'gemini-4-carbon';
    }

    // Build multi-turn contents array
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-12)) {
        if (h?.text && (h.sender === 'user' || h.sender === 'assistant')) {
          contents.push({
            role: h.sender === 'user' ? 'user' : 'model',
            parts: [{ text: String(h.text) }],
          });
        }
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const config: any = {
      systemInstruction: contextPrompt,
    };

    if (modelTier === 'deep' && model === 'gemini-4-carbon') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    } else if (modelTier === 'fast' && model === 'gemini-3.1-flash-lite') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
    }

    // Note: googleMaps cannot be combined with googleSearch; no responseMimeType/responseSchema with googleMaps
    if (groundingMode === 'search') {
      config.tools = [{ googleSearch: {} }];
    } else if (groundingMode === 'maps') {
      config.tools = [{ googleMaps: {} }];
      const lat = Number(userLocation?.latitude) || 43.3486;
      const lng = Number(userLocation?.longitude) || 11.4921;
      config.toolConfig = {
        retrievalConfig: {
          latLng: { latitude: lat, longitude: lng },
        },
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const groundingLinks = extractGroundingLinks(groundingChunks);
    const reply = response.text || getFallbackAnswer(message, role, weddingContext);

    return res.json({
      reply,
      source: model,
      groundingLinks,
    });
  } catch (error: any) {
    console.error('Error in /api/assistant:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'AI assistant request failed',
    });
  }
});

// ==========================================
// STUDIO: IMAGE CREATE & EDIT (gemini-nano-banana-2.1)
// ==========================================
app.post('/api/studio/image', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (!hasConfiguredGeminiKey()) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is required in Settings > Secrets.' });
    }
    const {
      prompt,
      sourceImageBase64,
      sourceMimeType = 'image/jpeg',
      aspectRatio = '4:3',
      imageSize = '1K',
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const parts: any[] = [];
    if (sourceImageBase64 && typeof sourceImageBase64 === 'string') {
      const cleanBase64 = sourceImageBase64.includes('base64,')
        ? sourceImageBase64.split('base64,')[1]
        : sourceImageBase64;
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: sourceMimeType,
        },
      });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-nano-banana-2.1',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    });

    let imageUrl = '';
    let captionText = '';

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
      } else if (part.text) {
        captionText += part.text;
      }
    }

    if (!imageUrl) {
      return res.status(502).json({ error: 'Model did not return an image. Please refine your prompt.' });
    }

    try {
      await insertStudioCreation({
        id: `cre-${Date.now()}`,
        kind: 'image',
        title: prompt.slice(0, 60),
        prompt,
        mediaUrl: imageUrl,
        lyricsOrText: captionText || null,
        createdBy: req.user?.name || 'Couple',
        userUid: req.user?.uid || null,
      });
    } catch {
      // Non-fatal persistence note
    }

    return res.json({
      imageUrl,
      text: captionText,
      model: 'gemini-nano-banana-2.1',
    });
  } catch (error: any) {
    console.error('Error in /api/studio/image:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Image generation failed' });
  }
});

// ==========================================
// STUDIO: MUSIC GENERATION (lyria-3-clip-preview / lyria-3-pro-preview)
// ==========================================
app.post('/api/studio/music', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (!hasConfiguredGeminiKey()) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is required in Settings > Secrets.' });
    }
    const {
      prompt,
      mode = 'clip',
      sourceImageBase64,
      sourceMimeType = 'image/jpeg',
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Music prompt is required' });
    }

    const model = mode === 'pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
    const contentsPayload: any = sourceImageBase64
      ? {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: sourceImageBase64.includes('base64,')
                  ? sourceImageBase64.split('base64,')[1]
                  : sourceImageBase64,
                mimeType: sourceMimeType,
              },
            },
          ],
        }
      : prompt;

    // Omit responseModalities so stream yields both encoded audio MP3 + lyrics text
    const response = await ai.models.generateContentStream({
      model,
      contents: contentsPayload,
    });

    const audioChunks: Buffer[] = [];
    let lyrics = '';
    let mimeType = 'audio/mpeg';

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (audioChunks.length === 0 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
        }
        if (part.text) {
          lyrics += part.text;
        }
      }
    }

    if (audioChunks.length === 0) {
      return res.status(502).json({ error: 'Music model did not emit audio chunks.' });
    }

    const audioBase64 = Buffer.concat(audioChunks).toString('base64');
    const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;

    return res.json({
      audioDataUrl,
      lyrics: lyrics.trim(),
      mimeType,
      model,
    });
  } catch (error: any) {
    console.error('Error in /api/studio/music:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Music generation failed' });
  }
});

// ==========================================
// STUDIO: VIDEO GENERATION & PHOTO ANIMATION (Interactions API: gemini-omni-1.2-flash)
// ==========================================
app.post('/api/studio/video', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (!hasConfiguredGeminiKey()) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is required in Settings > Secrets.' });
    }
    const {
      prompt,
      aspectRatio = '16:9',
      duration = '6s',
      sourceImageBase64,
      sourceMimeType = 'image/jpeg',
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Video prompt is required' });
    }

    const input: any = sourceImageBase64
      ? [
          {
            type: 'image',
            mime_type: sourceMimeType,
            data: sourceImageBase64.includes('base64,')
              ? sourceImageBase64.split('base64,')[1]
              : sourceImageBase64,
          },
          {
            type: 'text',
            text: prompt,
          },
        ]
      : prompt;

    const interaction = await ai.interactions.create(
      {
        model: 'gemini-omni-1.2-flash',
        input,
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: aspectRatio === '9:16' ? '9:16' : '16:9',
          duration,
        },
      },
      { timeout: 300000 }
    );

    const videoPart = interaction.output_video;
    if (!videoPart?.data) {
      return res.status(502).json({ error: 'Video generation did not return video bytes.' });
    }

    const mimeType = videoPart.mime_type || 'video/mp4';
    const videoDataUrl = `data:${mimeType};base64,${videoPart.data}`;

    return res.json({
      videoDataUrl,
      mimeType,
      model: 'gemini-omni-1.2-flash',
    });
  } catch (error: any) {
    console.error('Error in /api/studio/video:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Video generation failed' });
  }
});

// ==========================================
// STUDIO & ASSISTANT: AUDIO TRANSCRIPTION (gemini-3.5-transcribe)
// ==========================================
app.post('/api/studio/transcribe', async (req, res) => {
  try {
    if (!hasConfiguredGeminiKey()) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is required in Settings > Secrets.' });
    }
    const { audioBase64, mimeType = 'audio/webm', contextHint = '' } = req.body;
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const cleanBase64 = audioBase64.includes('base64,')
      ? audioBase64.split('base64,')[1]
      : audioBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: contextHint
              ? `Transcribe this audio accurately. Context: ${contextHint}`
              : 'Transcribe this audio accurately with proper punctuation.',
          },
        ],
      },
    });

    return res.json({
      text: response.text || '',
      model: 'gemini-3.5-transcribe',
    });
  } catch (error: any) {
    console.error('Error in /api/studio/transcribe:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Audio transcription failed' });
  }
});

function getFallbackAnswer(query: string, role: string, context: any): string {
  const q = query.toLowerCase();
  if (q.includes('dress code') || q.includes('wear')) {
    return 'The dress code is **Black Tie Optional / Tuscan Garden Chic**. Elegant floor-length dresses or sophisticated cocktail gowns for ladies, and tuxedos or dark formal suits for gentlemen. Block heels or wedges are recommended for the outdoor lawn and stone terraces!';
  }
  if (q.includes('park') || q.includes('shuttle') || q.includes('drive')) {
    return 'Complimentary valet parking is located at the Villa North Gate. For guests staying in Florence, private shuttles depart the Florence Grand Hotel lobby at 3:15 PM & 3:45 PM. Return shuttles run continuously from 11:00 PM until 2:30 AM.';
  }
  if (q.includes('confirm') || q.includes('how many guest') || q.includes('rsvp')) {
    const conf = context?.rsvpStats?.confirmed ?? 98;
    const pending = context?.rsvpStats?.pending ?? 28;
    const total = context?.rsvpStats?.invited ?? 142;
    return `Currently, **${conf} guests** have confirmed attendance out of ${total} invited (${pending} pending responses). Catering numbers are on track!`;
  }
  if (q.includes('budget') || q.includes('remaining') || q.includes('spend')) {
    const rem = context?.budgetStats?.remaining ?? 22600;
    return `You have **$${rem.toLocaleString()} remaining** in your wedding fund out of your $75,000 total budget. Your largest upcoming payment is the Villa Catering milestone ($6,800 due Aug 15).`;
  }
  if (q.includes('registry') || q.includes('gift')) {
    return 'Elena & Julian are registered for their dream Italian honeymoon fund, as well as artisanal tabletop collections at Heath Ceramics and Le Creuset. You can find direct links in the Registry tab!';
  }
  if (q.includes('time') || q.includes('when') || q.includes('schedule')) {
    return 'The ceremony commences promptly at 4:30 PM on Saturday, September 18, 2027. Welcome drinks and acoustic strings begin at 3:45 PM in the lower rose garden.';
  }
  return role === 'Couple'
    ? "I'm ready to help you plan! Ask me about your real-time RSVPs, remaining budget allocations, vendor deadlines, or creative ideas like signature cocktail pairings and seating strategies."
    : "I'm delighted to assist you with Elena & Julian's wedding celebration! Ask me anything regarding dress code, venue location, shuttle departures, or day-of timeline.";
}

// ==========================================
// SERVER + WEBSOCKET LIVE API BRIDGE (/live)
// ==========================================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '';
    if (reqUrl.startsWith('/live')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs: WebSocket) => {
    if (!hasConfiguredGeminiKey()) {
      clientWs.send(
        JSON.stringify({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        })
      );
      clientWs.close();
      return;
    }

    let session: any = null;
    try {
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are EverAfter Voice Concierge for Elena Vance and Julian Hayes\'s wedding at Villa La Selva Estate in Tuscany on Saturday, September 18, 2027 at 4:30 PM CET. Answer warmly, concisely, and naturally about dress code (Black Tie Optional / Tuscan Garden Chic), shuttles from Florence Grand Hotel (3:15 PM & 3:45 PM), valet parking at North Gate, ceremony schedule, seating, and local Tuscan recommendations.',
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ ready: true }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err: any) => {
            console.error('Gemini Live error:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({ error: err?.message || 'Live session encountered an error' })
              );
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close();
            }
          },
        },
      });
    } catch (err: any) {
      console.error('Failed to establish Gemini Live connection:', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: err?.message || 'Unable to connect to live voice session',
          })
        );
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (data) => {
      if (!session) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.text) {
          session.sendRealtimeInput({
            text: String(msg.text),
          });
        }
      } catch (err) {
        console.error('Error forwarding WS audio message:', err);
      }
    });

    clientWs.on('close', () => {
      try {
        session?.close();
      } catch {
        // Ignore close errors
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`EverAfter Wedding App server running on http://localhost:${PORT}`);
  });
}

startServer();
