import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Music,
  Film,
  Mic,
  MicOff,
  Sparkles,
  Upload,
  Loader2,
  BookmarkPlus,
  Check,
  Wand2,
  Play,
  FileAudio,
} from 'lucide-react';
import { AlbumPhoto, UserRole } from '../types/wedding';
import { compressImageFileToDataUrl } from '../utils/imageUpload';

interface WeddingStudioProps {
  userRole: UserRole;
  userName: string;
  onSaveToAlbum: (photo: AlbumPhoto) => void;
  onSaveVows: (vowsText: string) => void;
}

type StudioTab = 'image' | 'music' | 'video' | 'transcribe';

export const WeddingStudio: React.FC<WeddingStudioProps> = ({
  userRole,
  userName,
  onSaveToAlbum,
  onSaveVows,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('image');

  // Image Create & Edit state
  const [imagePrompt, setImagePrompt] = useState(
    'Watercolor crest of Villa La Selva olive branches wrapped in crimson silk ribbons with gold calligraphy'
  );
  const [imageAspectRatio, setImageAspectRatio] = useState<'1:1' | '4:3' | '16:9' | '3:4'>('4:3');
  const [sourceEditImage, setSourceEditImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [savedToAlbum, setSavedToAlbum] = useState(false);
  const editFileRef = useRef<HTMLInputElement | null>(null);

  // Music Generator state (Lyria)
  const [musicPrompt, setMusicPrompt] = useState(
    'Romantic Tuscan string quartet with acoustic nylon guitar and warm cello solo for a sunlit garden wedding ceremony'
  );
  const [musicMode, setMusicMode] = useState<'clip' | 'pro'>('clip');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedLyrics, setGeneratedLyrics] = useState('');
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);

  // Video Generation & Photo Animation state (Omni Flash Interactions API)
  const [videoPrompt, setVideoPrompt] = useState(
    'Cinematic golden-hour drone glide over Tuscan cypress avenues leading to Villa La Selva estate, warm candlelight, soft breeze'
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoSourceImage, setVideoSourceImage] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const videoImageRef = useRef<HTMLInputElement | null>(null);

  // Audio Transcription state (gemini-3.5-transcribe)
  const [transcriptText, setTranscriptText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [vowsSaved, setVowsSaved] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUploadRef = useRef<HTMLInputElement | null>(null);

  const [studioError, setStudioError] = useState<string | null>(null);

  const handleUploadSourceForEdit = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const dataUrl = await compressImageFileToDataUrl(files[0], 1024, 0.85);
    setSourceEditImage(dataUrl);
  };

  const handleUploadSourceForVideo = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const dataUrl = await compressImageFileToDataUrl(files[0], 1024, 0.85);
    setVideoSourceImage(dataUrl);
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePrompt.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setStudioError(null);
    setSavedToAlbum(false);

    try {
      const res = await fetch('/api/studio/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          sourceImageBase64: sourceEditImage,
          aspectRatio: imageAspectRatio,
          imageSize: '1K',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image studio failed');
      setGeneratedImage(data.imageUrl);
      setImageCaption(data.text || imagePrompt);
    } catch (err: any) {
      setStudioError(err?.message || 'Unable to generate image right now.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musicPrompt.trim() || isGeneratingMusic) return;
    setIsGeneratingMusic(true);
    setStudioError(null);

    try {
      const res = await fetch('/api/studio/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt,
          mode: musicMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Music generation failed');
      setGeneratedAudioUrl(data.audioDataUrl);
      setGeneratedLyrics(data.lyrics || '');
    } catch (err: any) {
      setStudioError(err?.message || 'Unable to compose soundtrack right now.');
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoPrompt.trim() || isGeneratingVideo) return;
    setIsGeneratingVideo(true);
    setStudioError(null);

    try {
      const res = await fetch('/api/studio/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
          duration: '6s',
          sourceImageBase64: videoSourceImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video generation failed');
      setGeneratedVideoUrl(data.videoDataUrl);
    } catch (err: any) {
      setStudioError(err?.message || 'Unable to render keepsake video right now.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const transcribeBlob = async (blob: Blob) => {
    setIsTranscribing(true);
    setStudioError(null);
    setVowsSaved(false);
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
          contextHint: 'Wedding vows, speech toast, or love note',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed');
      setTranscriptText(data.text || '');
    } catch (err: any) {
      setStudioError(err?.message || 'Unable to transcribe audio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    setStudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size > 0) transcribeBlob(blob);
      };
      rec.start();
      setIsRecording(true);
    } catch {
      setStudioError('Microphone permission is required to record vows or speeches.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <span className="text-xs uppercase tracking-widest text-rose-800 font-semibold font-mono">
            Tuscan Creative Atelier
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-1">
            Wedding Keepsake Studio
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Create & edit custom artwork, compose ceremony soundtracks, animate keepsake videos, and transcribe spoken vows.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-200/80 rounded-xl self-start sm:self-auto shrink-0 overflow-x-auto max-w-full">
          {[
            { id: 'image', label: 'Image Studio', icon: ImageIcon },
            { id: 'music', label: 'Soundtrack', icon: Music },
            { id: 'video', label: 'Video & Animate', icon: Film },
            { id: 'transcribe', label: 'Transcribe Vows', icon: Mic },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStudioError(null);
                  setActiveTab(tab.id as StudioTab);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-rose-700" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {studioError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {studioError}
        </div>
      )}

      {/* TAB 1: IMAGE CREATION & EDITING */}
      {activeTab === 'image' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleGenerateImage}
            className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif text-stone-900 font-bold">
                Create or Edit Keepsake Art
              </h3>
              <span className="text-[11px] font-mono text-stone-500">Nano Banana 2.1</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Optional Reference Photo to Edit / Restyle
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={editFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadSourceForEdit(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => editFileRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-stone-800 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-rose-700" />
                  <span>{sourceEditImage ? 'Change Photo' : 'Upload Photo to Edit'}</span>
                </button>
                {sourceEditImage && (
                  <div className="flex items-center gap-2">
                    <img
                      src={sourceEditImage}
                      alt="Reference"
                      className="w-10 h-10 rounded-lg object-cover border border-stone-200"
                    />
                    <button
                      type="button"
                      onClick={() => setSourceEditImage(null)}
                      className="text-xs text-rose-700 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Aspect Ratio
              </label>
              <div className="flex gap-2">
                {(['1:1', '4:3', '16:9', '3:4'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setImageAspectRatio(ratio)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono border ${
                      imageAspectRatio === ratio
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-700 border-stone-200'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Creative Instruction
              </label>
              <textarea
                rows={3}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the invitation artwork, watercolor crest, or photo edit..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-stone-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isGeneratingImage || !imagePrompt.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Crafting Artwork...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>{sourceEditImage ? 'Edit Photo with AI' : 'Generate Artwork'}</span>
                </>
              )}
            </button>
          </form>

          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="aspect-4/3 rounded-2xl bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center">
              {generatedImage ? (
                <img
                  src={generatedImage}
                  alt="Generated Wedding Artwork"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 text-stone-400 space-y-2">
                  <ImageIcon className="w-10 h-10 mx-auto opacity-60" />
                  <p className="text-xs">
                    Your bespoke invitation art or edited keepsake photo will appear here.
                  </p>
                </div>
              )}
            </div>

            {generatedImage && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-100">
                <p className="text-xs text-stone-600 truncate flex-1">{imageCaption}</p>
                <button
                  type="button"
                  disabled={savedToAlbum}
                  onClick={() => {
                    onSaveToAlbum({
                      id: `p-studio-${Date.now()}`,
                      uploaderName: userName,
                      uploaderRole: userRole,
                      imageUrl: generatedImage,
                      caption: imagePrompt.slice(0, 140),
                      timestamp: 'Studio Creation',
                      likesCount: 1,
                      isLiked: true,
                      tags: ['Couple'],
                    });
                    setSavedToAlbum(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  {savedToAlbum ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Added to Album</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3.5 h-3.5 text-amber-300" />
                      <span>Save to Live Album</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LYRIA MUSIC GENERATION */}
      {activeTab === 'music' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleGenerateMusic}
            className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif text-stone-900 font-bold">
                Compose Original Wedding Soundtrack
              </h3>
              <span className="text-[11px] font-mono text-stone-500">Lyria 3</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMusicMode('clip')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border ${
                  musicMode === 'clip'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 text-stone-700 border-stone-200'
                }`}
              >
                30s Processional Clip (Lyria Clip)
              </button>
              <button
                type="button"
                onClick={() => setMusicMode('pro')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border ${
                  musicMode === 'pro'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 text-stone-700 border-stone-200'
                }`}
              >
                Full Track (Lyria Pro)
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Mood, Instrumentation & Tempo
              </label>
              <textarea
                rows={3}
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                placeholder="Describe acoustic strings, waltz tempo, romantic vocals..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-stone-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isGeneratingMusic || !musicPrompt.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
            >
              {isGeneratingMusic ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Composing Soundtrack...</span>
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  <span>Generate Custom Track</span>
                </>
              )}
            </button>
          </form>

          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
            <h4 className="text-sm font-serif font-bold text-stone-900">
              Studio Audio Player & Lyrics
            </h4>
            {generatedAudioUrl ? (
              <div className="space-y-4">
                <audio controls src={generatedAudioUrl} className="w-full" />
                {generatedLyrics && (
                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-amber-200/80 text-xs text-stone-800 whitespace-pre-wrap max-h-56 overflow-y-auto font-serif">
                    {generatedLyrics}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-stone-400 space-y-2 border border-dashed border-stone-200 rounded-2xl bg-stone-50">
                <Play className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs">
                  Generate a custom Tuscan ceremony processional or cocktail-hour waltz.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VIDEO GENERATION & PHOTO ANIMATION */}
      {activeTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleGenerateVideo}
            className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif text-stone-900 font-bold">
                Generate Video or Animate Wedding Photo
              </h3>
              <span className="text-[11px] font-mono text-stone-500">Omni 1.2 Flash</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Optional Starting Photo to Animate
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={videoImageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadSourceForVideo(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => videoImageRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-stone-800 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-rose-700" />
                  <span>{videoSourceImage ? 'Change Photo' : 'Upload Photo to Animate'}</span>
                </button>
                {videoSourceImage && (
                  <div className="flex items-center gap-2">
                    <img
                      src={videoSourceImage}
                      alt="Start frame"
                      className="w-10 h-10 rounded-lg object-cover border border-stone-200"
                    />
                    <button
                      type="button"
                      onClick={() => setVideoSourceImage(null)}
                      className="text-xs text-rose-700 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Video Orientation
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVideoAspectRatio('16:9')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border ${
                    videoAspectRatio === '16:9'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200'
                  }`}
                >
                  16:9 Landscape
                </button>
                <button
                  type="button"
                  onClick={() => setVideoAspectRatio('9:16')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border ${
                    videoAspectRatio === '9:16'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200'
                  }`}
                >
                  9:16 Story Reel
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Scene & Motion Description
              </label>
              <textarea
                rows={3}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="Describe camera movement, lighting, and atmosphere..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-stone-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isGeneratingVideo || !videoPrompt.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
            >
              {isGeneratingVideo ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Rendering Cinematic Clip (may take ~1 min)...</span>
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" />
                  <span>{videoSourceImage ? 'Animate Photo into Video' : 'Generate Keepsake Video'}</span>
                </>
              )}
            </button>
          </form>

          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs flex items-center justify-center">
            {generatedVideoUrl ? (
              <video
                controls
                autoPlay
                loop
                src={generatedVideoUrl}
                className="w-full max-h-[360px] rounded-2xl bg-black"
              />
            ) : (
              <div className="py-12 text-center text-stone-400 space-y-2 w-full border border-dashed border-stone-200 rounded-2xl bg-stone-50">
                <Sparkles className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs px-6">
                  Generate a save-the-date video clip or bring a still engagement portrait to life.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIO TRANSCRIPTION (SPEECH & VOWS) */}
      {activeTab === 'transcribe' && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-serif text-stone-900 font-bold">
                Voice Vows & Toast Transcriber
              </h3>
              <p className="text-xs text-stone-500">
                Speak wedding vows aloud or upload a toast voice memo to transcribe into crisp editable text.
              </p>
            </div>
            <span className="text-[11px] font-mono text-stone-500">Gemini 3.5 Transcribe</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleRecording}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                isRecording
                  ? 'bg-rose-700 text-white animate-pulse'
                  : 'bg-stone-900 text-white hover:bg-stone-800'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isRecording ? 'Stop & Transcribe' : 'Record Voice Note'}</span>
            </button>

            <input
              ref={audioUploadRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) transcribeBlob(file);
              }}
            />
            <button
              type="button"
              onClick={() => audioUploadRef.current?.click()}
              className="px-4 py-2.5 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold flex items-center gap-2"
            >
              <FileAudio className="w-4 h-4 text-rose-700" />
              <span>Upload Audio File</span>
            </button>

            {isTranscribing && (
              <span className="text-xs text-rose-700 flex items-center gap-1.5 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcribing speech...
              </span>
            )}
          </div>

          <textarea
            rows={5}
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="Your transcribed wedding vows or reception toast will appear here..."
            className="w-full p-4 text-sm border border-stone-300 rounded-2xl bg-[#FAF7F2] font-serif text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />

          {transcriptText.trim() && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onSaveVows(transcriptText.trim());
                  setVowsSaved(true);
                }}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                {vowsSaved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                <span>{vowsSaved ? 'Saved to Couple Vows!' : 'Save as Heirloom Vows'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
