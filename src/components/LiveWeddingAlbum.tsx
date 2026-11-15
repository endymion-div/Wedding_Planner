import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Heart,
  Plus,
  Tag,
  Clock,
  Images,
  Trash2,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { AlbumPhoto, StoryMoment, UserRole } from '../types/wedding';
import {
  QueuedPhotoDraft,
  buildCaptionFromFilename,
  compressImageFileToDataUrl,
  prepareBatchPhotoPayloads,
} from '../utils/imageUpload';

interface LiveWeddingAlbumProps {
  photos: AlbumPhoto[];
  stories: StoryMoment[];
  userRole: UserRole;
  userName: string;
  onOpenStory: (index: number) => void;
  onUploadPhoto: (photo: AlbumPhoto) => void;
  onUploadPhotosBatch: (photos: AlbumPhoto[]) => Promise<void>;
  onPostStory: (story: StoryMoment) => void;
  onToggleLike: (photoId: string) => void;
}

export const LiveWeddingAlbum: React.FC<LiveWeddingAlbumProps> = ({
  photos,
  stories,
  userRole,
  userName,
  onOpenStory,
  onUploadPhotosBatch,
  onPostStory,
  onToggleLike,
}) => {
  const [activeTag, setActiveTag] = useState<string>('All');
  const [isPhotoUploadOpen, setIsPhotoUploadOpen] = useState(false);
  const [isStoryPostOpen, setIsStoryPostOpen] = useState(false);

  // Multi-photo batch upload state
  const [queuedDrafts, setQueuedDrafts] = useState<QueuedPhotoDraft[]>([]);
  const [selectedTag, setSelectedTag] = useState('Candid');
  const [sharedCaption, setSharedCaption] = useState('');
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [uploadSuccessCount, setUploadSuccessCount] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Story form states
  const [storyText, setStoryText] = useState('');
  const [storyPreview, setStoryPreview] = useState<string>('/images/venue_villa_estate_1794230269596.jpg');
  const storyFileInputRef = useRef<HTMLInputElement | null>(null);

  const tags = ['All', 'Couple', 'Portraits', 'Decor', 'Candid', 'Proposal', 'GuestMoments'];

  const filteredPhotos = photos.filter(
    (p) => activeTag === 'All' || p.tags.includes(activeTag)
  );

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessingFiles(true);
    setUploadError(null);

    try {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) {
        setUploadError('Please select valid image files (JPG, PNG, WebP).');
        setIsProcessingFiles(false);
        return;
      }

      const processed: QueuedPhotoDraft[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await compressImageFileToDataUrl(file, 1400, 0.82);
        processed.push({
          localId: `draft-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          dataUrl,
          caption: sharedCaption.trim() || buildCaptionFromFilename(file.name),
          tag: selectedTag,
          sizeBytes: file.size,
        });
      }

      setQueuedDrafts((prev) => [...prev, ...processed]);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to read one or more selected images.');
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queuedDrafts.length === 0 || isUploadingBatch) return;

    setIsUploadingBatch(true);
    setUploadError(null);

    try {
      const prepared = prepareBatchPhotoPayloads(
        queuedDrafts.map((d) => ({
          ...d,
          caption: d.caption.trim() || sharedCaption.trim() || buildCaptionFromFilename(d.fileName),
          tag: d.tag || selectedTag,
        })),
        userName,
        userRole,
        selectedTag
      );

      const formattedPhotos: AlbumPhoto[] = prepared.map((item) => ({
        id: item.id,
        uploaderName: item.uploaderName,
        uploaderRole: item.uploaderRole,
        imageUrl: item.imageUrl,
        caption: item.caption,
        timestamp: item.timestampLabel,
        likesCount: 1,
        isLiked: true,
        tags: item.tags,
      }));

      await onUploadPhotosBatch(formattedPhotos);
      setUploadSuccessCount(formattedPhotos.length);
      setQueuedDrafts([]);
      setSharedCaption('');
      setTimeout(() => {
        setUploadSuccessCount(null);
        setIsPhotoUploadOpen(false);
      }, 900);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to save uploaded photos.');
    } finally {
      setIsUploadingBatch(false);
    }
  };

  const handleStoryFileChange = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith('image/')) return;
    const dataUrl = await compressImageFileToDataUrl(file, 1200, 0.84);
    setStoryPreview(dataUrl);
  };

  const handleStorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newStory: StoryMoment = {
      id: `s-${Date.now()}`,
      userName,
      userRole,
      mediaUrl: storyPreview,
      text: storyText.trim() || undefined,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      viewed: false,
    };

    onPostStory(newStory);
    setStoryText('');
    setIsStoryPostOpen(false);
  };

  return (
    <section className="space-y-6">
      {/* 24-Hour Stories Carousel Section */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-semibold tracking-tight text-stone-900">
              Wedding Week Stories
            </h3>
            <span className="text-[11px] text-stone-500 font-mono">
              24h Disappearing
            </span>
          </div>

          <button
            onClick={() => setIsStoryPostOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Story</span>
          </button>
        </div>

        {/* Stories Horizontal Tray */}
        <div className="flex items-center gap-4 overflow-x-auto py-2 scrollbar-none">
          <button
            onClick={() => setIsStoryPostOpen(true)}
            className="flex flex-col items-center gap-1.5 shrink-0 focus:outline-none group"
          >
            <div className="relative w-15 h-15 rounded-full border-2 border-dashed border-stone-300 hover:border-rose-400 bg-stone-50 flex items-center justify-center text-stone-500 group-hover:text-rose-600 transition-colors">
              <Camera className="w-5 h-5" />
              <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                +
              </div>
            </div>
            <span className="text-[11px] font-medium text-stone-600 truncate max-w-16">
              Your Story
            </span>
          </button>

          {stories.map((story, idx) => (
            <button
              key={story.id}
              onClick={() => onOpenStory(idx)}
              className="flex flex-col items-center gap-1.5 shrink-0 focus:outline-none group"
            >
              <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 group-hover:scale-105 transition-transform">
                <div className="p-0.5 bg-white rounded-full">
                  <img
                    src={story.mediaUrl}
                    alt={story.userName}
                    className="w-13 h-13 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-stone-700 truncate max-w-16">
                {story.userName.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Album Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <span className="text-xs uppercase tracking-widest text-rose-800 font-semibold font-mono">
            Shared Memory Repository
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-1">
            Live Wedding Album
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Upload multiple photos at once—automatically synced so every guest and shared link sees them immediately.
          </p>
        </div>

        <button
          onClick={() => {
            setUploadSuccessCount(null);
            setIsPhotoUploadOpen(true);
          }}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm active:scale-95"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Photos (Multi-Select)</span>
        </button>
      </div>

      {/* Filter Category Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTag === tag
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Responsive Photo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPhotos.map((photo) => (
          <article
            key={photo.id}
            className="group bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div className="relative aspect-4/3 overflow-hidden bg-stone-100">
              <img
                src={photo.imageUrl}
                alt={photo.caption}
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-full text-[11px] font-medium">
                <Tag className="w-3 h-3 text-rose-300" />
                <span>{photo.tags[0] || 'Moments'}</span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs sm:text-sm text-stone-800 font-medium leading-relaxed">
                {photo.caption}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs text-stone-500">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-stone-900">
                    {photo.uploaderName}
                  </span>
                  <span>·</span>
                  <span>{photo.timestamp}</span>
                </div>

                <button
                  onClick={() => onToggleLike(photo.id)}
                  aria-label="Like photo"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    photo.isLiked
                      ? 'bg-rose-50 text-rose-600'
                      : 'hover:bg-stone-100 text-stone-600'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      photo.isLiked ? 'fill-current text-rose-600' : ''
                    }`}
                  />
                  <span className="font-mono tabular-nums">{photo.likesCount}</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Multi-Photo Batch Upload Modal */}
      {isPhotoUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Images className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="text-lg font-serif text-stone-900">
                    Upload Photos to Live Album
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Select or drag-and-drop multiple photos from your device at once.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoUploadOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg"
                aria-label="Close upload modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBatchSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Drag and drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                  isDraggingOver
                    ? 'border-rose-500 bg-rose-50/70'
                    : 'border-stone-300 bg-stone-50/70 hover:border-rose-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center mb-2">
                  {isProcessingFiles ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <p className="text-sm font-semibold text-stone-900">
                  {isProcessingFiles
                    ? 'Optimizing photos for gallery...'
                    : 'Drop multiple photos here, or browse files'}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Supports selecting many JPG, PNG, or WebP photos simultaneously
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 px-4 py-2 text-xs font-semibold text-stone-900 bg-white border border-stone-300 hover:bg-stone-100 rounded-xl shadow-2xs"
                >
                  Select Multiple Photos
                </button>
              </div>

              {/* Quick Album Sample Option if user wants to test without local files */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <label className="font-semibold text-stone-700 shrink-0">Default Tag:</label>
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-xl bg-white"
                  >
                    <option value="Candid">Candid</option>
                    <option value="Portraits">Portraits</option>
                    <option value="Decor">Decor</option>
                    <option value="Couple">Couple</option>
                    <option value="GuestMoments">GuestMoments</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={sharedCaption}
                  onChange={(e) => setSharedCaption(e.target.value)}
                  placeholder="Optional default caption for batch..."
                  className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border border-stone-300 rounded-xl"
                />
              </div>

              {/* Batch Queue Grid */}
              {queuedDrafts.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800">
                      Ready to Upload ({queuedDrafts.length}{' '}
                      {queuedDrafts.length === 1 ? 'photo' : 'photos'})
                    </span>
                    <button
                      type="button"
                      onClick={() => setQueuedDrafts([])}
                      className="text-rose-700 hover:underline font-medium"
                    >
                      Clear Queue
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                    {queuedDrafts.map((draft) => (
                      <div
                        key={draft.localId}
                        className="flex gap-2.5 p-2 rounded-2xl border border-stone-200 bg-stone-50/70 items-start"
                      >
                        <img
                          src={draft.dataUrl}
                          alt={draft.fileName}
                          className="w-16 h-16 rounded-xl object-cover shrink-0 border border-stone-200"
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-mono text-stone-500 truncate">
                              {draft.fileName}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setQueuedDrafts((prev) =>
                                  prev.filter((item) => item.localId !== draft.localId)
                                )
                              }
                              aria-label={`Remove ${draft.fileName}`}
                              className="text-stone-400 hover:text-rose-600 p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={draft.caption}
                            onChange={(e) =>
                              setQueuedDrafts((prev) =>
                                prev.map((item) =>
                                  item.localId === draft.localId
                                    ? { ...item, caption: e.target.value }
                                    : item
                                )
                              )
                            }
                            placeholder="Photo caption..."
                            className="w-full px-2 py-1 text-xs border border-stone-300 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {uploadError}
                </div>
              )}

              {uploadSuccessCount !== null && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Saved {uploadSuccessCount} {uploadSuccessCount === 1 ? 'photo' : 'photos'} to the live wedding gallery!
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsPhotoUploadOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={queuedDrafts.length === 0 || isUploadingBatch || isProcessingFiles}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-45 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {isUploadingBatch && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isUploadingBatch
                      ? 'Saving Photos...'
                      : `Publish ${queuedDrafts.length > 0 ? queuedDrafts.length : ''} ${
                          queuedDrafts.length === 1 ? 'Photo' : 'Photos'
                        }`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Story Modal */}
      {isStoryPostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-rose-600" />
                <h3 className="text-lg font-serif text-stone-900">Post 24h Story</h3>
              </div>
              <button
                onClick={() => setIsStoryPostOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-medium"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleStorySubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-stone-700">
                    Choose Photo or Upload Your Own
                  </label>
                  <button
                    type="button"
                    onClick={() => storyFileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-rose-700 hover:underline"
                  >
                    Upload Custom Image
                  </button>
                  <input
                    ref={storyFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleStoryFileChange(e.target.files)}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    '/images/wedding_tablescape_candlelight_1794235742765.jpg',
                    '/images/venue_villa_estate_1794230269596.jpg',
                    '/images/story_florence_rainstorm_1794235743505.jpg',
                    '/images/story_proposal_moment_1794230267202.jpg',
                  ].map((imgSrc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setStoryPreview(imgSrc)}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        storyPreview === imgSrc
                          ? 'border-rose-600 ring-2 ring-rose-600/30'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={imgSrc}
                        alt="Story Sample"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Story Caption / Greeting
                </label>
                <input
                  type="text"
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="e.g. Just checked into the Tuscan estate!"
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStoryPostOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
                >
                  Publish 24h Story
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
