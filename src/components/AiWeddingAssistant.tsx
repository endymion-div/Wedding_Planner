import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  Lightbulb,
  Globe,
  MapPin,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  ExternalLink,
  Volume2,
  Loader2,
} from 'lucide-react';
import { UserRole } from '../types/wedding';
import type { GroundingLink } from '../utils/imageUpload';

interface AiWeddingAssistantProps {
  userRole: UserRole;
  weddingContext: {
    rsvpStats: any;
    budgetStats: any;
  };
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: string;
  groundingLinks?: GroundingLink[];
}

type ModelTier = 'general' | 'fast' | 'complex' | 'deep';
type GroundingMode = 'none' | 'search' | 'maps';

function pcmToBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const AiWeddingAssistant: React.FC<AiWeddingAssistantProps> = ({
  userRole,
  weddingContext,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text:
        userRole === 'Couple'
          ? `Hello Elena & Julian! I am your EverAfter Concierge. Ask about live RSVPs, budget allocations, brainstorm signature cocktails, search the web, discover Tuscan places on Google Maps, or start a live voice call.`
          : `Welcome to Elena & Julian's wedding celebration! Ask me about the dress code, shuttles, ceremony schedule, local Siena restaurants on Google Maps, or start a live voice call.`,
      timestamp: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelTier, setModelTier] = useState<ModelTier>('general');
  const [groundingMode, setGroundingMode] = useState<GroundingMode>('none');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );

  // Audio dictation transcription state (gemini-3.5-transcribe)
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Live Voice Call state (gemini-3.8-live via /live WebSocket)
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [voiceTranscripts, setVoiceTranscripts] = useState<Array<{ who: 'You' | 'Concierge'; text: string }>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const couplePrompts = [
    'How many guests have confirmed so far?',
    'What is our remaining wedding budget?',
    'Best boutique wineries & trattorias near Villa La Selva',
    'Latest autumn floral centerpiece trends for Tuscany',
    'Design a 3-tier seating & late-night snack plan',
  ];

  const guestPrompts = [
    'What is the dress code?',
    'Where do I park & is there a shuttle?',
    'Best boutique hotels near Castelnuovo Berardenga',
    'September weather norms & sightseeing in Siena',
    'What time does the ceremony begin?',
  ];

  const activePrompts = userRole === 'Couple' ? couplePrompts : guestPrompts;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      stopLiveVoice();
    };
  }, []);

  const requestUserLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    if (userCoords) return Promise.resolve(userCoords);
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserCoords(c);
          resolve(c);
        },
        () => resolve(null),
        { timeout: 3000 }
      );
    });
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
      let locationPayload = userCoords;
      if (groundingMode === 'maps' && !locationPayload) {
        locationPayload = await requestUserLocation();
      }

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map((m) => ({ sender: m.sender, text: m.text })),
          role: userRole,
          weddingContext,
          modelTier,
          groundingMode,
          userLocation: locationPayload || { latitude: 43.3486, longitude: 11.4921 },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to reach AI Concierge');
      }

      const botMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || "I'm here to assist you with all wedding details!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data.source,
        groundingLinks: Array.isArray(data.groundingLinks) ? data.groundingLinks : [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: err?.message || 'Unable to connect right now. Ceremony begins at 4:30 PM at Villa La Selva.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Microphone Dictation -> Transcribe via gemini-3.5-transcribe
  const toggleDictation = async () => {
    if (isDictating) {
      mediaRecorderRef.current?.stop();
      setIsDictating(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;

        setIsTranscribing(true);
        try {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/studio/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              mimeType: blob.type || 'audio/webm',
              contextHint: 'Wedding planning question',
            }),
          });
          const data = await res.json();
          if (data.text) {
            setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
          }
        } catch (err) {
          console.error('Dictation transcription failed:', err);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsDictating(true);
    } catch {
      setVoiceStatus('Microphone access required for voice dictation.');
    }
  };

  // Live Voice Call (16kHz PCM input -> WS /live -> 24kHz PCM playback)
  const playPcmChunk = (audioCtx: AudioContext, base64Pcm: string) => {
    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000;
    }

    const buffer = audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    const startTime = Math.max(audioCtx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  };

  const startLiveVoice = async () => {
    if (isVoiceActive) return;
    setVoiceStatus('Connecting live concierge audio...');
    setVoiceTranscripts([]);
    nextStartTimeRef.current = 0;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${window.location.host}/live`);
      wsRef.current = ws;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (ev) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const base64 = pcmToBase64(ev.inputBuffer.getChannelData(0));
          wsRef.current.send(JSON.stringify({ audio: base64 }));
        }
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.ready) {
          setVoiceStatus('Live Voice Active — Speak naturally');
          setIsVoiceActive(true);
        }
        if (msg.error) {
          setVoiceStatus(msg.error);
          stopLiveVoice();
        }
        if (msg.audio && outputAudioCtxRef.current) {
          playPcmChunk(outputAudioCtxRef.current, msg.audio);
        }
        if (msg.interrupted && outputAudioCtxRef.current) {
          nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
        }
        if (msg.inputTranscript) {
          setVoiceTranscripts((prev) => [...prev.slice(-6), { who: 'You', text: msg.inputTranscript }]);
        }
        if (msg.outputTranscript) {
          setVoiceTranscripts((prev) => [...prev.slice(-6), { who: 'Concierge', text: msg.outputTranscript }]);
        }
      };

      ws.onerror = () => {
        setVoiceStatus('Voice connection closed.');
        stopLiveVoice();
      };
      ws.onclose = () => {
        setIsVoiceActive(false);
      };
    } catch (err: any) {
      setVoiceStatus(err?.message || 'Microphone permission is required for live voice.');
      stopLiveVoice();
    }
  };

  const stopLiveVoice = () => {
    try {
      processorRef.current?.disconnect();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      inputAudioCtxRef.current?.close();
      outputAudioCtxRef.current?.close();
      wsRef.current?.close();
    } catch {
      // Ignore cleanup errors
    }
    processorRef.current = null;
    micStreamRef.current = null;
    inputAudioCtxRef.current = null;
    outputAudioCtxRef.current = null;
    wsRef.current = null;
    setIsVoiceActive(false);
  };

  return (
    <section className="space-y-6">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <span className="text-xs uppercase tracking-widest text-rose-800 font-semibold font-mono">
            Intelligent Concierge
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-1">
            AI Wedding Assistant & Live Voice
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Multi-turn planning with Google Search & Google Maps place grounding plus real-time voice conversations.
          </p>
        </div>
      </div>

      {/* Live Voice Conversation Bar */}
      {(isVoiceActive || voiceStatus || voiceTranscripts.length > 0) && (
        <div className="bg-gradient-to-r from-stone-900 via-rose-950 to-stone-900 text-white rounded-3xl p-4 sm:p-5 border border-stone-800 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className={`w-4 h-4 ${isVoiceActive ? 'text-emerald-400' : 'text-amber-300'}`} />
              <span className="text-xs font-mono font-semibold">
                {voiceStatus || 'Live Voice Session'}
              </span>
            </div>
            {isVoiceActive && (
              <button
                type="button"
                onClick={stopLiveVoice}
                className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                Disconnect
              </button>
            )}
          </div>
          {voiceTranscripts.length > 0 && (
            <div className="space-y-1.5 max-h-32 overflow-y-auto text-xs bg-black/30 rounded-2xl p-3">
              {voiceTranscripts.map((vt, i) => (
                <p key={i} className="leading-relaxed">
                  <span className="font-bold text-amber-300">{vt.who}: </span>
                  <span className="text-stone-100">{vt.text}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Chat Container */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm overflow-hidden flex flex-col h-[640px]">
        {/* Chat Header + Reasoning & Grounding Controls */}
        <div className="p-3.5 sm:p-4 bg-stone-50 border-b border-stone-200 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-stone-900">EverAfter Concierge</h3>
                <p className="text-[11px] text-stone-500">
                  {userRole} Mode · Tuscan Wedding Context
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={isVoiceActive ? stopLiveVoice : startLiveVoice}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                  isVoiceActive
                    ? 'bg-rose-700 text-white hover:bg-rose-800 animate-pulse'
                    : 'bg-stone-900 text-white hover:bg-stone-800'
                }`}
              >
                {isVoiceActive ? (
                  <>
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>End Voice Call</span>
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-3.5 h-3.5 text-amber-300" />
                    <span>Start Live Voice Call</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setMessages([
                    {
                      id: 'reset',
                      sender: 'assistant',
                      text:
                        userRole === 'Couple'
                          ? 'Conversation cleared. How can I help you plan today?'
                          : 'Conversation cleared. What wedding details can I help you with?',
                      timestamp: 'Just now',
                    },
                  ]);
                }}
                title="Reset Chat"
                aria-label="Reset Chat"
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg transition-colors"
              >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            </div>
          </div>

          {/* Model Tier + Grounding Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-mono text-stone-500 mr-1">Grounding:</span>
              <button
                type="button"
                onClick={() => setGroundingMode('none')}
                className={`px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                  groundingMode === 'none'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Wedding Data
              </button>
              <button
                type="button"
                onClick={() => setGroundingMode('search')}
                className={`px-2.5 py-1 rounded-lg font-medium border flex items-center gap-1 transition-colors ${
                  groundingMode === 'search'
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Google Search</span>
              </button>
              <button
                type="button"
                onClick={() => setGroundingMode('maps')}
                className={`px-2.5 py-1 rounded-lg font-medium border flex items-center gap-1 transition-colors ${
                  groundingMode === 'maps'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <MapPin className="w-3 h-3" />
                <span>Google Maps Places</span>
              </button>
            </div>

            {groundingMode === 'none' && (
              <div className="flex items-center gap-1">
                <span className="font-mono text-stone-500 mr-1">Depth:</span>
                {(
                  [
                    { id: 'fast', label: 'Fast' },
                    { id: 'general', label: 'Balanced' },
                    { id: 'complex', label: 'Pro' },
                    { id: 'deep', label: 'Deep Think' },
                  ] as const
                ).map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setModelTier(tier.id)}
                    className={`px-2 py-0.5 rounded-md font-medium border ${
                      modelTier === tier.id
                        ? 'bg-amber-100 border-amber-400 text-amber-950'
                        : 'bg-white border-stone-200 text-stone-600'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-stone-50/30">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed space-y-2.5 ${
                  msg.sender === 'user'
                    ? 'bg-stone-900 text-white rounded-br-xs'
                    : 'bg-white text-stone-800 border border-stone-200/90 shadow-xs rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Grounding Chunks Display (Google Maps Places & Google Search Sources) */}
                {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                  <div className="pt-2 border-t border-stone-100 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-semibold block">
                      Verified Sources & Map Locations
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.groundingLinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                            link.type === 'maps'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                              : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                          }`}
                        >
                          {link.type === 'maps' ? (
                            <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
                          ) : (
                            <Globe className="w-3 h-3 text-rose-700 shrink-0" />
                          )}
                          <span className="truncate max-w-[200px]">{link.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-stone-400 font-mono">
                <span>{msg.timestamp}</span>
                {msg.source && <span>· {msg.source}</span>}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-stone-500 bg-white p-3 rounded-2xl border border-stone-200 w-fit">
              <Sparkles className="w-3.5 h-3.5 text-rose-600 animate-spin" />
              <span>Consulting wedding registries & live sources...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100 overflow-x-auto scrollbar-none flex items-center gap-1.5">
          <span className="text-[11px] text-stone-400 font-mono shrink-0 mr-1 flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-500" /> Quick:
          </span>
          {activePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p)}
              className="text-xs bg-white hover:bg-stone-100 text-stone-700 px-3 py-1 rounded-full border border-stone-200 whitespace-nowrap transition-colors shrink-0 shadow-2xs"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar with Mic Dictation */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white border-t border-stone-200 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleDictation}
            disabled={isTranscribing}
            title={isDictating ? 'Stop voice dictation' : 'Dictate message with microphone'}
            aria-label={isDictating ? 'Stop voice dictation' : 'Dictate message'}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shrink-0 border ${
              isDictating
                ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isDictating ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              groundingMode === 'maps'
                ? 'Search Tuscan trattorias, villas, or transit near Siena...'
                : groundingMode === 'search'
                ? 'Search live travel advisories, seasonal trends, weather...'
                : userRole === 'Couple'
                ? 'Ask about guests, budget balance, vows, or seating...'
                : 'Ask about dress code, venue location, parking...'
            }
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 bg-stone-50/50"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="w-10 h-10 rounded-2xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </section>
  );
};
