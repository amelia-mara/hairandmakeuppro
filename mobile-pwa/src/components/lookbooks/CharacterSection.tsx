import { useState } from 'react';
import type { Character, Look, CastProfile } from '@/types';
import { createEmptyCastProfile } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { LookCard } from './LookCard';
import { BottomSheet, Input, Textarea, Button } from '../ui';

interface CharacterSectionProps {
  character: Character;
  looks: Look[];
  capturedScenes: number;
  totalScenes: number;
  getCaptureProgress: (look: Look) => { captured: number; total: number };
  onAddLook: () => void;
}

export function CharacterSection({
  character,
  looks,
  capturedScenes,
  totalScenes,
  getCaptureProgress,
  onAddLook,
}: CharacterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCastProfile, setShowCastProfile] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const { getCastProfile, updateCastProfile } = useProjectStore();
  const profile = getCastProfile(character.id) || createEmptyCastProfile(character.id);
  const hasProfileData = profile.actorName || profile.phone || profile.email || profile.allergies || profile.specialRequirements;

  return (
    <>
      <div>
        {/* Character Header - not in card */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${character.avatarColour || '#C9A962'} 0%, ${adjustColor(character.avatarColour || '#C9A962', -20)} 100%)`,
            }}
          >
            {character.initials}
          </div>

          {/* Character info */}
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-bold text-gold truncate">{character.name}</h3>
            {profile.actorName && (
              <p className="text-xs text-text-secondary truncate">{profile.actorName}</p>
            )}
            <p className="text-xs text-text-muted mt-0.5">
              {looks.length} look{looks.length !== 1 ? 's' : ''} • {capturedScenes}/{totalScenes} scenes
            </p>
          </div>
          {/* Indicators */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasProfileData && (
              <span className="w-2 h-2 rounded-full bg-success" title="Profile complete" />
            )}
            {profile.allergies && (
              <span className="w-2 h-2 rounded-full bg-red-500" title="Has allergies" />
            )}
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={`w-5 h-5 text-text-light transition-transform duration-200 flex-shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expandable content - indented */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pl-[52px] space-y-2.5">
          {/* Cast Profile Section */}
          <div className="bg-card rounded-card shadow-card overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCastProfile(!showCastProfile)}
              className="w-full px-4 py-3 flex items-center justify-between text-left touch-manipulation"
            >
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Cast Profile</span>
              <svg
                className={`w-4 h-4 text-text-muted transition-transform ${showCastProfile ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showCastProfile && (
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
                {/* Actor Name */}
                {profile.actorName && (
                  <div>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">ACTOR</span>
                    <p className="text-sm text-text-primary mt-0.5">{profile.actorName}</p>
                  </div>
                )}

                {/* Contact Details */}
                {(profile.phone || profile.email) && (
                  <div className="grid grid-cols-2 gap-3">
                    {profile.phone && (
                      <div>
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">PHONE</span>
                        <a href={`tel:${profile.phone}`} className="text-sm text-gold mt-0.5 block">
                          {profile.phone}
                        </a>
                      </div>
                    )}
                    {profile.email && (
                      <div>
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">EMAIL</span>
                        <a href={`mailto:${profile.email}`} className="text-sm text-gold mt-0.5 block truncate">
                          {profile.email}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Agent Details */}
                {(profile.agentName || profile.agentPhone || profile.agentEmail) && (
                  <div>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">AGENT</span>
                    <div className="mt-1 text-sm">
                      {profile.agentName && <p className="text-text-primary">{profile.agentName}</p>}
                      <div className="flex gap-3 mt-0.5">
                        {profile.agentPhone && (
                          <a href={`tel:${profile.agentPhone}`} className="text-gold">
                            {profile.agentPhone}
                          </a>
                        )}
                        {profile.agentEmail && (
                          <a href={`mailto:${profile.agentEmail}`} className="text-gold truncate">
                            {profile.agentEmail}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Allergies - highlighted */}
                {profile.allergies && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">ALLERGIES</span>
                    <p className="text-sm text-red-700 mt-0.5">{profile.allergies}</p>
                  </div>
                )}

                {/* Special Requirements */}
                {profile.specialRequirements && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">SPECIAL REQUIREMENTS</span>
                    <p className="text-sm text-amber-700 mt-0.5">{profile.specialRequirements}</p>
                  </div>
                )}

                {/* Skin Type */}
                {profile.skinType && (
                  <div>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">SKIN TYPE</span>
                    <p className="text-sm text-text-primary mt-0.5">{profile.skinType}</p>
                  </div>
                )}

                {/* Notes */}
                {profile.notes && (
                  <div>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">NOTES</span>
                    <p className="text-sm text-text-secondary mt-0.5">{profile.notes}</p>
                  </div>
                )}

                {/* Empty state / Edit button */}
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => setEditProfileOpen(true)}
                >
                  {hasProfileData ? 'Edit Profile' : 'Add Profile Information'}
                </Button>
              </div>
            )}
          </div>

          {looks.length > 0 ? (
            <>
              {looks.map(look => (
                <LookCard
                  key={look.id}
                  look={look}
                  character={character}
                  progress={getCaptureProgress(look)}
                />
              ))}

              {/* Add look button */}
              <button
                onClick={onAddLook}
                className="w-full py-3.5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-text-muted bg-card border-2 border-dashed border-gray-200 rounded-card hover:border-gold-300 hover:text-gold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add New Look
              </button>
            </>
          ) : (
            <div className="bg-card rounded-card p-6 text-center">
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-[13px] text-text-muted mb-1">No looks defined</p>
              <p className="text-[11px] text-text-light mb-3">Sync from desktop or create manually</p>
              <button
                onClick={onAddLook}
                className="px-5 py-2.5 rounded-full bg-gold-100/50 text-gold text-xs font-semibold"
              >
                + Add Look
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Edit Cast Profile Modal */}
      <EditCastProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        character={character}
        profile={profile}
        onSave={(updates) => {
          updateCastProfile(character.id, updates);
          setEditProfileOpen(false);
        }}
      />
    </>
  );
}

// Edit Modal Component
interface EditCastProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  profile: CastProfile;
  onSave: (updates: Partial<CastProfile>) => void;
}

function EditCastProfileModal({
  isOpen,
  onClose,
  character,
  profile,
  onSave,
}: EditCastProfileModalProps) {
  const [actorName, setActorName] = useState(profile.actorName);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [agentName, setAgentName] = useState(profile.agentName);
  const [agentPhone, setAgentPhone] = useState(profile.agentPhone);
  const [agentEmail, setAgentEmail] = useState(profile.agentEmail);
  const [allergies, setAllergies] = useState(profile.allergies);
  const [specialRequirements, setSpecialRequirements] = useState(profile.specialRequirements);
  const [skinType, setSkinType] = useState(profile.skinType);
  const [notes, setNotes] = useState(profile.notes);

  const handleSave = () => {
    onSave({
      actorName,
      phone,
      email,
      agentName,
      agentPhone,
      agentEmail,
      allergies,
      specialRequirements,
      skinType,
      notes,
    });
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`${character.name} - Cast Profile`}
      height="auto"
    >
      <div className="space-y-4 pb-4">
        {/* Actor Details Section */}
        <div>
          <h4 className="font-semibold text-text-primary mb-2">Actor Details</h4>
          <div className="space-y-3">
            <Input
              label="ACTOR NAME"
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              placeholder="Full name"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="PHONE"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44..."
                type="tel"
              />
              <Input
                label="EMAIL"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="actor@email.com"
                type="email"
              />
            </div>
          </div>
        </div>

        {/* Agent Details Section */}
        <div>
          <h4 className="font-semibold text-text-primary mb-2">Agent Details</h4>
          <div className="space-y-3">
            <Input
              label="AGENT NAME"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Agent or agency name"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="AGENT PHONE"
                value={agentPhone}
                onChange={(e) => setAgentPhone(e.target.value)}
                placeholder="+44..."
                type="tel"
              />
              <Input
                label="AGENT EMAIL"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder="agent@agency.com"
                type="email"
              />
            </div>
          </div>
        </div>

        {/* Health & Requirements Section */}
        <div>
          <h4 className="font-semibold text-text-primary mb-2">Health & Requirements</h4>
          <div className="space-y-3">
            <Textarea
              label="ALLERGIES"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="List any allergies (latex, adhesives, specific products...)"
              rows={2}
            />
            <Textarea
              label="SPECIAL REQUIREMENTS"
              value={specialRequirements}
              onChange={(e) => setSpecialRequirements(e.target.value)}
              placeholder="Sensitive skin, prefers certain products, etc."
              rows={2}
            />
            <Input
              label="SKIN TYPE"
              value={skinType}
              onChange={(e) => setSkinType(e.target.value)}
              placeholder="Oily, dry, combination, sensitive..."
            />
          </div>
        </div>

        {/* Notes Section */}
        <div>
          <Textarea
            label="ADDITIONAL NOTES"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any other relevant information..."
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" fullWidth onClick={handleSave}>
            Save Profile
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

// Helper to darken a color for gradient
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
