import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart,
  Camera,
  CalendarCheck,
  DollarSign,
  Bot,
  Palmtree,
  Users,
  QrCode,
  Globe,
  Sparkles,
  X,
} from 'lucide-react';
import {
  UserRole,
  StoryMilestone,
  AlbumPhoto,
  StoryMoment,
  Guest,
  Expense,
  RsvpStatus,
  DietaryOption,
} from './types/wedding';
import {
  INITIAL_WEDDING_DETAILS,
  INITIAL_STORY_MILESTONES,
  INITIAL_STORIES,
  INITIAL_ALBUM_PHOTOS,
  INITIAL_GUESTS,
  INITIAL_EXPENSES,
  INITIAL_HONEYMOON_DESTINATIONS,
} from './data/weddingData';
import { calculateRsvpStats } from './utils/rsvp';
import { calculateBudgetMetrics } from './utils/budget';
import {
  SupportedCurrency,
  SupportedLanguage,
  SupportedTimezone,
  TRANSLATIONS,
} from './utils/globalization';
import { useAuth } from './context/AuthContext';

import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { StorylineTimeline } from './components/StorylineTimeline';
import { LiveWeddingAlbum } from './components/LiveWeddingAlbum';
import { LogisticsAndRsvp } from './components/LogisticsAndRsvp';
import { GuestSeatingPlan } from './components/GuestSeatingPlan';
import { BudgetTracker } from './components/BudgetTracker';
import { AiWeddingAssistant } from './components/AiWeddingAssistant';
import { HoneymoonMatchmaker } from './components/HoneymoonMatchmaker';
import { WeddingStudio } from './components/WeddingStudio';
import { StoryViewerModal } from './components/StoryViewerModal';
import { AuthRoleModal } from './components/AuthRoleModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import {
  RomanticSettingsModal,
  AmbianceLighting,
  WaxSealChoice,
} from './components/RomanticSettingsModal';
import { WeddingCardModal } from './components/WeddingCardModal';
import { GlobalSettingsModal } from './components/GlobalSettingsModal';

export default function App() {
  const { user, getIdToken } = useAuth();

  // Navigation & Role States
  const [currentRole, setCurrentRole] = useState<UserRole>('Couple');
  const [currentUserName, setCurrentUserName] = useState<string>('Elena & Julian');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('elena.julian@wedding.com');
  const [activeTab, setActiveTab] = useState<string>('timeline');

  // Case A Google Maps Demo Key Quota Banner State
  const [isMapsQuotaExceeded, setIsMapsQuotaExceeded] = useState(false);
  const [isMapsQuotaDismissed, setIsMapsQuotaDismissed] = useState(false);

  // Globalization Preferences (Currency, Timezone, Language)
  const [currency, setCurrency] = useState<SupportedCurrency>('EUR');
  const [timezone, setTimezone] = useState<SupportedTimezone>('cet');
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);

  // Wedding Card & QR Scanner Modal
  const [isWeddingCardOpen, setIsWeddingCardOpen] = useState(false);

  // Romantic Settings & Ambiance States
  const [isRomanticSettingsOpen, setIsRomanticSettingsOpen] = useState(false);
  const [ambiance, setAmbiance] = useState<AmbianceLighting>('candlelit');
  const [waxSeal, setWaxSeal] = useState<WaxSealChoice>('crimson');
  const [vowsExcerpt, setVowsExcerpt] = useState<string>(
    INITIAL_WEDDING_DETAILS.couple.vowsExcerpt ||
      'I choose you today and all our tomorrows, through Florentine rainstorms, starry Tuscan hills, and every quiet morning in between.'
  );

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);

  // Applet Data States
  const [milestones, setMilestones] = useState<StoryMilestone[]>(INITIAL_STORY_MILESTONES);
  const [photos, setPhotos] = useState<AlbumPhoto[]>(INITIAL_ALBUM_PHOTOS);
  const [stories, setStories] = useState<StoryMoment[]>(INITIAL_STORIES);
  const [guests, setGuests] = useState<Guest[]>(INITIAL_GUESTS);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [totalBudget, setTotalBudget] = useState<number>(75000);

  // Listen for Case A Google Maps Quota exhaustion events
  useEffect(() => {
    const onQuotaExceeded = () => {
      setIsMapsQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Sync Firebase Auth signed-in user display info if authenticated
  useEffect(() => {
    if (user) {
      if (user.displayName) setCurrentUserName(user.displayName);
      if (user.email) setCurrentUserEmail(user.email);
    }
  }, [user]);

  // Hydrate persistent state from Cloud SQL PostgreSQL backend on mount
  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/wedding-data');
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled || !data) return;

        if (Array.isArray(data.milestones) && data.milestones.length > 0) {
          setMilestones(data.milestones);
        }
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          setPhotos(data.photos);
        }
        if (Array.isArray(data.stories) && data.stories.length > 0) {
          setStories(data.stories);
        }
        if (Array.isArray(data.guests) && data.guests.length > 0) {
          setGuests(data.guests);
        }
        if (Array.isArray(data.expenses) && data.expenses.length > 0) {
          setExpenses(data.expenses);
        }
        if (typeof data.totalBudget === 'number' && data.totalBudget > 0) {
          setTotalBudget(data.totalBudget);
        }
        if (typeof data.vowsExcerpt === 'string' && data.vowsExcerpt.trim().length > 0) {
          setVowsExcerpt(data.vowsExcerpt);
        }
      } catch {
        // Silently retain seeded initial state if backend is offline
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const buildAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const token = await getIdToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Optional auth token
    }
    return headers;
  }, [getIdToken]);

  // Translations
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Context Metrics for Assistant & Honeymoon
  const rsvpStats = calculateRsvpStats(guests);
  const budgetStats = calculateBudgetMetrics(totalBudget, expenses);

  // Handlers
  const handleRoleSwitch = async (role: UserRole) => {
    setCurrentRole(role);
    if (!user) {
      if (role === 'Couple') {
        setCurrentUserName('Elena & Julian');
        setCurrentUserEmail('elena.julian@wedding.com');
      } else {
        setCurrentUserName('Sofia Rossi');
        setCurrentUserEmail('sofia.rossi@example.com');
      }
    } else {
      const headers = await buildAuthHeaders();
      fetch('/api/auth/role', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role }),
      }).catch(() => {});
    }
  };

  const handleSelectCustomProfile = (role: UserRole, name: string, email: string) => {
    setCurrentRole(role);
    setCurrentUserName(name);
    setCurrentUserEmail(email);
  };

  const handleAddMilestone = async (m: StoryMilestone) => {
    setMilestones((prev) => [m, ...prev]);
    const headers = await buildAuthHeaders();
    fetch('/api/milestones', {
      method: 'POST',
      headers,
      body: JSON.stringify(m),
    }).catch(() => {});
  };

  const handleUploadPhotosBatch = async (newPhotos: AlbumPhoto[]) => {
    if (!newPhotos || newPhotos.length === 0) return;
    const headers = await buildAuthHeaders();
    const res = await fetch('/api/photos/batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: newPhotos.map((p) => ({
          id: p.id,
          uploaderName: p.uploaderName,
          uploaderRole: p.uploaderRole,
          imageUrl: p.imageUrl,
          caption: p.caption,
          timestampLabel: p.timestamp,
          tags: p.tags,
        })),
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to save photos to the live gallery.');
    }

    const data = await res.json().catch(() => null);
    const savedPhotos: AlbumPhoto[] =
      Array.isArray(data?.photos) && data.photos.length > 0 ? data.photos : newPhotos;
    setPhotos((prev) => [...savedPhotos, ...prev]);
  };

  const handleUploadPhoto = async (p: AlbumPhoto) => {
    try {
      await handleUploadPhotosBatch([p]);
    } catch {
      setPhotos((prev) => [p, ...prev]);
    }
  };

  const handlePostStory = async (s: StoryMoment) => {
    setStories((prev) => [s, ...prev]);
    const headers = await buildAuthHeaders();
    fetch('/api/stories', {
      method: 'POST',
      headers,
      body: JSON.stringify(s),
    }).catch(() => {});
  };

  const handleToggleLike = (photoId: string) => {
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id === photoId) {
          const isLiked = !p.isLiked;
          return {
            ...p,
            isLiked,
            likesCount: isLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
          };
        }
        return p;
      })
    );
    fetch(`/api/photos/${encodeURIComponent(photoId)}/like`, {
      method: 'POST',
    }).catch(() => {});
  };

  const handleUpdateGuestStatus = async (
    guestId: string,
    status: RsvpStatus,
    plusOneName?: string,
    dietary?: DietaryOption
  ) => {
    setGuests((prev) =>
      prev.map((g) => {
        if (g.id === guestId) {
          return {
            ...g,
            status,
            plusOneName: plusOneName !== undefined ? plusOneName : g.plusOneName,
            dietary: dietary !== undefined ? dietary : g.dietary,
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return g;
      })
    );
    const headers = await buildAuthHeaders();
    fetch(`/api/guests/${encodeURIComponent(guestId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, plusOneName, dietary }),
    }).catch(() => {});
  };

  const handleReassignTable = async (guestId: string, newTable: number) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, tableNumber: newTable } : g))
    );
    const headers = await buildAuthHeaders();
    fetch(`/api/guests/${encodeURIComponent(guestId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ tableNumber: newTable }),
    }).catch(() => {});
  };

  const handleCheckInGuest = async (guestId: string) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, status: 'Confirmed' as RsvpStatus } : g))
    );
    const headers = await buildAuthHeaders();
    fetch(`/api/guests/${encodeURIComponent(guestId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'Confirmed' }),
    }).catch(() => {});
  };

  const handleAddGuest = async (g: Guest) => {
    setGuests((prev) => [g, ...prev]);
    const headers = await buildAuthHeaders();
    fetch('/api/guests', {
      method: 'POST',
      headers,
      body: JSON.stringify(g),
    }).catch(() => {});
  };

  const handleUpdateTotalBudget = async (newBudget: number) => {
    setTotalBudget(newBudget);
    const headers = await buildAuthHeaders();
    fetch('/api/settings/budget', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ totalBudget: newBudget }),
    }).catch(() => {});
  };

  const handleAddExpense = async (e: Expense) => {
    setExpenses((prev) => [e, ...prev]);
    const headers = await buildAuthHeaders();
    fetch('/api/expenses', {
      method: 'POST',
      headers,
      body: JSON.stringify(e),
    }).catch(() => {});
  };

  const handleToggleExpensePaid = (expenseId: string) => {
    setExpenses((prev) =>
      prev.map((exp) => {
        if (exp.id === expenseId) {
          const isNowPaid = !exp.isPaid;
          return {
            ...exp,
            isPaid: isNowPaid,
            paidAmount: isNowPaid ? exp.actualCost : 0,
          };
        }
        return exp;
      })
    );
    fetch(`/api/expenses/${encodeURIComponent(expenseId)}/toggle-paid`, {
      method: 'PATCH',
    }).catch(() => {});
  };

  const handleSaveVows = async (newVows: string) => {
    setVowsExcerpt(newVows);
    const headers = await buildAuthHeaders();
    fetch('/api/settings/vows', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ vowsExcerpt: newVows }),
    }).catch(() => {});
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between font-sans selection:bg-rose-100 selection:text-rose-900 pb-20 lg:pb-8 transition-colors duration-500 ${
        ambiance === 'candlelit'
          ? 'bg-[#FAF8F5] text-stone-800'
          : ambiance === 'goldenHour'
          ? 'bg-[#FDF9F3] text-stone-800'
          : 'bg-stone-50 text-stone-800'
      }`}
    >
      {/* Case A Google Maps Quota Notification Banner */}
      {isMapsQuotaExceeded && !isMapsQuotaDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm flex items-center justify-center gap-3">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
          <button
            type="button"
            onClick={() => setIsMapsQuotaDismissed(true)}
            aria-label="Dismiss Maps quota notice"
            className="p-1 text-amber-800 hover:text-amber-950 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <Header
        currentRole={currentRole}
        currentUserName={currentUserName}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenRomanticSettings={() => setIsRomanticSettingsOpen(true)}
        onOpenGlobalSettings={() => setIsGlobalSettingsOpen(true)}
        onOpenWeddingCard={() => setIsWeddingCardOpen(true)}
        isCandlelit={ambiance === 'candlelit'}
        currency={currency}
        language={language}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-8">
        {/* Hero Banner with Countdown, Wax Seal Monogram & Role Switcher */}
        <HeroBanner
          currentRole={currentRole}
          onSwitchRole={handleRoleSwitch}
          weddingDateStr={INITIAL_WEDDING_DETAILS.date}
          waxSealUrl={
            waxSeal === 'crimson'
              ? '/images/vintage_wax_seal_crest_1794235743246.jpg'
              : undefined
          }
          onOpenRomanticSettings={() => setIsRomanticSettingsOpen(true)}
        />

        <div className="space-y-8">
          {/* Desktop Navigation Segmented Bar */}
          <div className="hidden lg:flex items-center justify-between border-b border-stone-200 pb-2 gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'timeline', label: t.story || 'Our Story', icon: Heart },
                { id: 'album', label: t.album || 'Live Album', icon: Camera },
                { id: 'logistics', label: t.rsvp || 'Logistics & RSVP', icon: CalendarCheck },
                { id: 'seating', label: t.seating || 'Seating Plan', icon: Users },
                ...(currentRole === 'Couple'
                  ? [{ id: 'budget', label: t.budget || 'Budget Tracker', icon: DollarSign }]
                  : []),
                { id: 'assistant', label: t.concierge || 'AI Concierge', icon: Bot },
                { id: 'studio', label: 'Studio', icon: Sparkles },
                { id: 'honeymoon', label: t.honeymoon || 'Honeymoon Matchmaker', icon: Palmtree },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Action Buttons on Desktop */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsWeddingCardOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-all shadow-xs"
              >
                <QrCode className="w-3.5 h-3.5 text-rose-800" />
                <span>Wedding Card & Pass</span>
              </button>

              <button
                onClick={() => setIsGlobalSettingsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-all shadow-xs"
              >
                <Globe className="w-3.5 h-3.5 text-rose-700" />
                <span>
                  {currency} · {timezone.toUpperCase()}
                </span>
              </button>
            </div>
          </div>

          {/* Active Module Container */}
          <div className="transition-opacity duration-200">
            {activeTab === 'timeline' && (
              <StorylineTimeline
                milestones={milestones}
                userRole={currentRole}
                onAddMilestone={handleAddMilestone}
              />
            )}

            {activeTab === 'album' && (
              <LiveWeddingAlbum
                photos={photos}
                stories={stories}
                userRole={currentRole}
                userName={currentUserName}
                onOpenStory={(idx) => setStoryViewerIndex(idx)}
                onUploadPhoto={handleUploadPhoto}
                onUploadPhotosBatch={handleUploadPhotosBatch}
                onPostStory={handlePostStory}
                onToggleLike={handleToggleLike}
              />
            )}

            {activeTab === 'logistics' && (
              <LogisticsAndRsvp
                weddingDetails={INITIAL_WEDDING_DETAILS}
                guests={guests}
                userRole={currentRole}
                currentGuestName={currentUserName}
                onUpdateGuestStatus={handleUpdateGuestStatus}
                onAddGuest={handleAddGuest}
                onUpdateTableNumber={handleReassignTable}
                onOpenWeddingCard={() => setIsWeddingCardOpen(true)}
                selectedTimezone={timezone}
              />
            )}

            {activeTab === 'seating' && (
              <GuestSeatingPlan
                guests={guests}
                userRole={currentRole}
                onUpdateTableNumber={handleReassignTable}
              />
            )}

            {activeTab === 'budget' && (
              <BudgetTracker
                expenses={expenses}
                totalBudget={totalBudget}
                userRole={currentRole}
                currency={currency}
                onUpdateTotalBudget={handleUpdateTotalBudget}
                onAddExpense={handleAddExpense}
                onToggleExpensePaid={handleToggleExpensePaid}
              />
            )}

            {activeTab === 'assistant' && (
              <AiWeddingAssistant
                userRole={currentRole}
                weddingContext={{
                  rsvpStats,
                  budgetStats: {
                    total: budgetStats.totalBudget,
                    spent: budgetStats.totalActual,
                    remaining: budgetStats.totalRemainingBalance,
                  },
                }}
              />
            )}

            {activeTab === 'studio' && (
              <WeddingStudio
                userRole={currentRole}
                userName={currentUserName}
                onSaveToAlbum={handleUploadPhoto}
                onSaveVows={handleSaveVows}
              />
            )}

            {activeTab === 'honeymoon' && (
              <HoneymoonMatchmaker
                destinations={INITIAL_HONEYMOON_DESTINATIONS}
                remainingBudget={budgetStats.totalRemainingBalance}
                currency={currency}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 mt-12 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-serif text-stone-800 text-sm">
            EverAfter — Elena Vance & Julian Hayes
          </p>
          <p className="text-stone-400 text-[11px]">
            Villa La Selva Estate, Tuscany · September 18, 2027 · {currency} /{' '}
            {timezone.toUpperCase()}
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation (Ergonomic Thumb Zone) */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        userRole={currentRole}
      />

      {/* 24h Story Viewer Modal */}
      {storyViewerIndex !== null && (
        <StoryViewerModal
          stories={stories}
          initialIndex={storyViewerIndex}
          onClose={() => setStoryViewerIndex(null)}
          onLikeStory={() => {}}
        />
      )}

      {/* Authentication & Role Switcher Modal */}
      {isAuthModalOpen && (
        <AuthRoleModal
          currentRole={currentRole}
          currentUserName={currentUserName}
          onSelectRole={handleSelectCustomProfile}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}

      {/* Romantic Settings & Ambiance Modal */}
      <RomanticSettingsModal
        isOpen={isRomanticSettingsOpen}
        onClose={() => setIsRomanticSettingsOpen(false)}
        ambiance={ambiance}
        onChangeAmbiance={setAmbiance}
        waxSeal={waxSeal}
        onChangeWaxSeal={setWaxSeal}
        vowsExcerpt={vowsExcerpt}
        onSaveVows={handleSaveVows}
        isCouple={currentRole === 'Couple'}
      />

      {/* Printable Wedding Invitation Card & QR Scanner Modal */}
      <WeddingCardModal
        isOpen={isWeddingCardOpen}
        onClose={() => setIsWeddingCardOpen(false)}
        guests={guests}
        onCheckInGuest={handleCheckInGuest}
        selectedTimezone={timezone}
        selectedLanguage={language}
      />

      {/* Global Settings Modal (Currency, Timezone, Language, Travel) */}
      <GlobalSettingsModal
        isOpen={isGlobalSettingsOpen}
        onClose={() => setIsGlobalSettingsOpen(false)}
        currency={currency}
        onChangeCurrency={setCurrency}
        timezone={timezone}
        onChangeTimezone={setTimezone}
        language={language}
        onChangeLanguage={setLanguage}
      />
    </div>
  );
}
