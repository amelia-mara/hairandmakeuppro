import { useState } from 'react';
import { clsx } from 'clsx';
import type { Character, CastProfile } from '@/types';
import { createEmptyCastProfile } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { CharacterAvatar } from '../characters/CharacterAvatar';
import { BottomSheet, Input, Textarea, Button } from '../ui';

interface CastProfileCardProps {
  character: Character;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function CastProfileCard({
  character,
  isExpanded = false,
  onToggleExpand,
}: CastProfileCardProps) {
  const { getCastProfile, updateCastProfile } = useProjectStore();
  const [editOpen, setEditOpen] = useState(false);

  const profile = getCastProfile(character.id) || createEmptyCastProfile(character.id);
  const hasProfileData = profile.actorName || profile.phone || profile.email || profile.allergies || profile.specialRequirements;

  return (
    <>
      <div className="card">
        {/* Header - always visible */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="w-full flex items-center gap-3 text-left touch-manipulation"
        >
          <CharacterAvatar character={character} size="md" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary truncate">
              {character.name}
            </h3>
            {profile.actorName && (
              <p className="text-xs text-text-muted truncate">
                {profile.actorName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasProfileData && (
              <span className="w-2 h-2 rounded-full bg-success" title="Profile complete" />
            )}
            <svg
              className={clsx('w-5 h-5 text-text-muted transition-transform', {
                'rotate-180': isExpanded,
              })}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            {/* Actor Name */}
            {profile.actorName && (
              <div>
                <span className="field-label">ACTOR</span>
                <p className="text-sm text-text-primary mt-0.5">{profile.actorName}</p>
              </div>
            )}

            {/* Contact Details */}
            {(profile.phone || profile.email) && (
              <div className="grid grid-cols-2 gap-3">
                {profile.phone && (
                  <div>
                    <span className="field-label">PHONE</span>
                    <a href={`tel:${profile.phone}`} className="text-sm text-gold mt-0.5 block">
                      {profile.phone}
                    </a>
                  </div>
                )}
                {profile.email && (
                  <div>
                    <span className="field-label">EMAIL</span>
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
                <span className="field-label">AGENT</span>
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
                <span className="field-label text-red-600">ALLERGIES</span>
                <p className="text-sm text-red-700 mt-0.5">{profile.allergies}</p>
              </div>
            )}

            {/* Special Requirements */}
            {profile.specialRequirements && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <span className="field-label text-amber-600">SPECIAL REQUIREMENTS</span>
                <p className="text-sm text-amber-700 mt-0.5">{profile.specialRequirements}</p>
              </div>
            )}

            {/* Skin Type */}
            {profile.skinType && (
              <div>
                <span className="field-label">SKIN TYPE</span>
                <p className="text-sm text-text-primary mt-0.5">{profile.skinType}</p>
              </div>
            )}

            {/* Notes */}
            {profile.notes && (
              <div>
                <span className="field-label">NOTES</span>
                <p className="text-sm text-text-secondary mt-0.5">{profile.notes}</p>
              </div>
            )}

            {/* Empty state */}
            {!hasProfileData && (
              <p className="text-sm text-text-muted text-center py-2">
                No profile information added yet
              </p>
            )}

            {/* Edit button */}
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => setEditOpen(true)}
            >
              {hasProfileData ? 'Edit Profile' : 'Add Profile Information'}
            </Button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditCastProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        character={character}
        profile={profile}
        onSave={(updates) => {
          updateCastProfile(character.id, updates);
          setEditOpen(false);
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
