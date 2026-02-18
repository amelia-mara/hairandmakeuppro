import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import { supabase } from '@/lib/supabase';
import { updateUserProfile } from '@/services/supabaseAuth';
import { BETA_MODE } from '@/types';

interface UserProfileScreenProps {
  onBack: () => void;
  onNavigateToBilling?: () => void;
}

export function UserProfileScreen({ onBack, onNavigateToBilling }: UserProfileScreenProps) {
  const { user, signOut } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Theme options
  const themeOptions: { value: Theme; label: string; icon: JSX.Element }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  // Get user initials for avatar
  const getInitials = () => {
    if (!user?.name) return 'U';
    const parts = user.name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  // Get tier display
  const getTierDisplay = () => {
    // In beta mode, show "Beta Tester" instead of actual tier
    if (BETA_MODE) return 'Beta Tester';
    if (!user?.tier) return 'Free';
    const tiers: Record<string, string> = {
      trainee: 'Trainee',
      artist: 'Artist',
      designer: 'Designer',
      supervisor: 'Supervisor',
    };
    return tiers[user.tier] || user.tier;
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !user) {
      setMessage({ type: 'error', text: 'Name cannot be empty' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await updateUserProfile(user.id, { name: editName.trim() });
      if (error) throw error;

      // Update local state in authStore
      useAuthStore.setState({ user: { ...user, name: editName.trim() } });
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setMessage({ type: 'error', text: 'No email address found' });
      return;
    }

    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Password reset email sent! Check your inbox.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send password reset email' });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSignOut = () => {
    signOut();
  };

  // Clear message after 4 seconds
  if (message) {
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-text-primary">My Account</h1>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4 pb-safe-bottom">
        {/* Message */}
        {message && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Card */}
        <section className="mb-6">
          <div className="card">
            <div className="flex items-center gap-4 pb-4 border-b border-border mb-4">
              <div className="w-16 h-16 rounded-full bg-gold-100 flex items-center justify-center text-gold text-xl font-bold">
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-field w-full text-lg font-bold"
                    autoFocus
                  />
                ) : (
                  <h2 className="text-lg font-bold text-text-primary truncate">{user?.name || 'User'}</h2>
                )}
                <p className="text-sm text-text-muted truncate">{user?.email || ''}</p>
                <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-gold-50 rounded-full">
                  <span className="text-xs font-medium text-gold">{getTierDisplay()}</span>
                </div>
              </div>
            </div>

            {/* Edit/Save Button */}
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(user?.name || '');
                    }}
                    className="flex-1 py-2 px-4 rounded-button border border-border text-text-muted text-sm font-medium active:scale-98 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex-1 py-2 px-4 rounded-button gold-gradient text-white text-sm font-medium active:scale-98 transition-transform disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-2 px-4 rounded-button border border-border text-text-primary text-sm font-medium active:scale-98 transition-transform"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Account Settings */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            ACCOUNT SETTINGS
          </h2>
          <div className="card divide-y divide-border">
            {/* Password Reset */}
            <button
              onClick={handlePasswordReset}
              disabled={isResettingPassword}
              className="w-full flex items-center gap-4 px-4 py-3 active:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-text-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-text-primary">
                  {isResettingPassword ? 'Sending...' : 'Reset Password'}
                </p>
                <p className="text-xs text-text-muted">Send password reset email</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Billing Details */}
            <button
              onClick={onNavigateToBilling}
              className="w-full flex items-center gap-4 px-4 py-3 active:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-text-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-text-primary">Billing & Bank Details</p>
                <p className="text-xs text-text-muted">For timesheets and invoices</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </section>

        {/* Subscription - Hidden in beta mode */}
        {BETA_MODE ? (
          <section className="mb-6">
            <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
              BETA ACCESS
            </h2>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Full Access Enabled</p>
                  <p className="text-xs text-text-muted">Thank you for beta testing!</p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mb-6">
            <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
              SUBSCRIPTION
            </h2>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Current Plan</p>
                  <p className="text-xs text-text-muted">
                    {getTierDisplay()} tier
                  </p>
                </div>
                <button
                  onClick={onNavigateToBilling}
                  className="px-4 py-2 rounded-button border border-gold text-gold text-sm font-medium active:scale-98 transition-transform"
                >
                  Upgrade
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Appearance / Theme Section */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            APPEARANCE
          </h2>
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-primary">Theme</span>
              <span className="text-xs text-text-muted capitalize">{theme}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    theme === option.value
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border text-text-muted hover:border-gold/50'
                  }`}
                >
                  {option.icon}
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Sign Out */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            SESSION
          </h2>
          <div className="card">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </div>
              <span className="text-sm font-medium text-red-500">Sign Out</span>
            </button>
          </div>
        </section>

        {/* App Version */}
        <div className="text-center text-xs text-text-muted py-4">
          <p>Checks Happy v1.0.0</p>
        </div>
      </div>
    </>
  );
}
