import React, { useState } from 'react';
import { X, Shield, LogOut, CheckCircle2, Sparkles } from 'lucide-react';
import { UserRole } from '../types/wedding';
import { useAuth } from '../context/AuthContext';

interface AuthRoleModalProps {
  currentRole: UserRole;
  currentUserName: string;
  onSelectRole: (role: UserRole, name: string, email: string) => void;
  onClose: () => void;
}

export const AuthRoleModal: React.FC<AuthRoleModalProps> = ({
  currentRole,
  currentUserName,
  onSelectRole,
  onClose,
}) => {
  const { user, signInWithGoogle, signOut, authError, getIdToken } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customRole, setCustomRole] = useState<UserRole>('Guest');

  const presetProfiles = [
    {
      role: 'Couple' as UserRole,
      name: 'Elena & Julian',
      email: 'elena.julian@wedding.com',
      avatarColor: 'bg-rose-600',
      description: 'Admin Access — Full control over budget, guest approvals, timeline & settings.',
    },
    {
      role: 'Guest' as UserRole,
      name: 'Sofia Rossi',
      email: 'sofia.rossi@example.com',
      avatarColor: 'bg-amber-600',
      description: 'Contributor Access — Submit RSVP, upload live album photos & post 24h stories.',
    },
    {
      role: 'Guest' as UserRole,
      name: 'David Chen',
      email: 'david.chen@example.com',
      avatarColor: 'bg-stone-700',
      description: 'Viewer Access — View event logistics, map directions & chat with AI concierge.',
    },
  ];

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    const signedUser = await signInWithGoogle();
    setSigningIn(false);
    if (signedUser) {
      onSelectRole(
        customRole,
        signedUser.displayName || signedUser.email?.split('@')[0] || 'Google Guest',
        signedUser.email || ''
      );
      const token = await getIdToken();
      if (token) {
        fetch('/api/auth/role', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: customRole }),
        }).catch(() => {});
      }
      onClose();
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customEmail.trim()) return;
    onSelectRole(customRole, customName.trim(), customEmail.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-rose-700 font-semibold">
              Account & Access Control
            </span>
            <h3 className="text-lg font-serif text-stone-900 mt-0.5">
              Sign In or Switch Profile
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Real Firebase Auth Google Sign-In Section */}
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-3">
          {user ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User avatar'}
                    className="w-9 h-9 rounded-full object-cover border border-stone-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-rose-700 text-white flex items-center justify-center text-xs font-bold">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-900 truncate flex items-center gap-1">
                    {user.displayName || 'Authenticated User'}
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </p>
                  <p className="text-[11px] text-stone-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                }}
                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 flex items-center gap-1.5 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-rose-700" />
                  <span>Google Account Sign-In</span>
                </label>
                <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCustomRole('Guest')}
                    className={`px-2 py-0.5 rounded-md font-medium ${
                      customRole === 'Guest' ? 'bg-stone-900 text-white' : 'text-stone-600'
                    }`}
                  >
                    Guest
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomRole('Couple')}
                    className={`px-2 py-0.5 rounded-md font-medium ${
                      customRole === 'Couple' ? 'bg-rose-700 text-white' : 'text-stone-600'
                    }`}
                  >
                    Couple
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={signingIn}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{signingIn ? 'Connecting with Google...' : `Continue with Google as ${customRole}`}</span>
              </button>

              {authError && (
                <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                  {authError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Persona Switcher */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-stone-700">
            Quick Preview Persona:
          </label>

          <div className="space-y-2">
            {presetProfiles.map((profile, i) => {
              const isSelected =
                currentRole === profile.role && currentUserName === profile.name;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onSelectRole(profile.role, profile.name, profile.email);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'border-rose-600 bg-rose-50/60 ring-1 ring-rose-600/30'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full ${profile.avatarColor} text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5`}
                  >
                    {profile.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">
                        {profile.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                          profile.role === 'Couple'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {profile.role} Role
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                      {profile.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Guest Entry */}
        <div className="pt-2 border-t border-stone-100">
          <details className="text-xs text-stone-600 group">
            <summary className="font-semibold cursor-pointer text-stone-700 hover:text-stone-900">
              Enter wedding guest name & email...
            </summary>
            <form onSubmit={handleCustomSubmit} className="mt-3 space-y-3">
              <div>
                <input
                  type="text"
                  required
                  placeholder="Your Full Name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <input
                  type="email"
                  required
                  placeholder="Your Email Address"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl text-xs"
              >
                Continue as {customRole}
              </button>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
};
