import type { ContinuityEvent } from '@/types';

export const mockContinuityEvents: ContinuityEvent[] = [
  {
    id: 'cont-1',
    characterId: 'char-emma',
    type: 'injury',
    description: 'Cut on left temple — sustained when Emma rushes through Claire\'s ransacked flat (Sc.15) and catches her head on a broken shelf bracket.',
    startSceneId: 'scene-15',
    endSceneId: undefined,
    stages: [
      {
        sceneId: 'scene-15',
        description: 'Moment of impact — off-screen. No visible wound in this scene (she doesn\'t notice it immediately).',
        intensity: 1,
      },
      {
        sceneId: 'scene-16',
        description: 'Fresh cut visible. Small laceration approx. 2cm on left temple. Bright red, slightly bleeding. Use rigid collodion base with blood gel. Tiny trickle down the side of the face.',
        intensity: 8,
      },
      {
        sceneId: 'scene-17',
        description: 'Cut has been cleaned (hospital setting) but still raw. Blood wiped away. Wound edges visible. Slight swelling and redness around the area. Apply rigid collodion, no blood.',
        intensity: 6,
      },
      {
        sceneId: 'scene-18',
        description: 'Next day. Wound beginning to scab. Use scar wax for raised texture. Light bruising (purple-yellow) spreading from wound edges. No fresh blood.',
        intensity: 5,
      },
      {
        sceneId: 'scene-19',
        description: 'Same day as Sc.18, evening. Scab forming more prominently. Bruise yellowing around edges. The wound is noticeably healing.',
        intensity: 4,
      },
      {
        sceneId: 'scene-20',
        description: 'Day 8. Healing scab. Use scar wax with matte texture. Bruise is fading — mostly yellow-green at edges. The cut will leave a small scar.',
        intensity: 3,
      },
    ],
  },
  {
    id: 'cont-2',
    characterId: 'char-matt',
    type: 'injury',
    description: 'Matt\'s black eye — arrives at work in Sc.14 with a black eye. He claims he walked into a door; the implication is that someone connected to the story sent a warning.',
    startSceneId: 'scene-14',
    endSceneId: 'scene-19',
    stages: [
      {
        sceneId: 'scene-14',
        description: 'Fresh black eye, left side. Deep purple-blue bruising around the orbital bone. Slight swelling of the lower lid. Use bruise wheel with alcohol-activated paints for layered depth. Capillary burst detail in the white of the eye (contact lens if approved).',
        intensity: 9,
      },
      {
        sceneId: 'scene-15',
        description: 'Same day. Identical to Sc.14 — no change in bruise appearance. Ensure exact continuity match from reference photos.',
        intensity: 9,
      },
      {
        sceneId: 'scene-19',
        description: 'Day 7. Bruise is transitioning: centre still dark purple, outer edges turning green-yellow. Swelling reduced. The eye is open fully now. Use bruise wheel — layer purple centre with yellow/green gradient outward.',
        intensity: 5,
      },
    ],
  },
  {
    id: 'cont-3',
    characterId: 'char-emma',
    type: 'makeup',
    description: 'Emma\'s progressive exhaustion — her under-eye circles and overall pallor worsen across story days 1 through 7, then begin to recover slightly by Day 8.',
    startSceneId: 'scene-1',
    endSceneId: 'scene-20',
    stages: [
      {
        sceneId: 'scene-1',
        description: 'Day 1 baseline. Light natural dark circles. Skin slightly dull. She hasn\'t been sleeping well but it\'s not dramatic yet.',
        intensity: 3,
      },
      {
        sceneId: 'scene-4',
        description: 'Day 2. Circles slightly deeper. Skin a shade paler. She\'s working long hours but adrenaline is keeping her going.',
        intensity: 4,
      },
      {
        sceneId: 'scene-8',
        description: 'Day 3. Noticeable dark circles. Starting to look gaunt. Add subtle hollowing to cheeks with contour. Lips drier.',
        intensity: 5,
      },
      {
        sceneId: 'scene-12',
        description: 'Day 5. Deep purple-brown circles under eyes. Skin is grey-toned. She looks exhausted. This should be visibly worse than earlier scenes.',
        intensity: 7,
      },
      {
        sceneId: 'scene-16',
        description: 'Day 6. Peak exhaustion combined with the emotional shock of Joanna\'s collapse. Worst she looks in the entire film. Red-rimmed eyes from crying on top of deep fatigue.',
        intensity: 9,
      },
      {
        sceneId: 'scene-20',
        description: 'Day 8. Still tired but the weight has lifted. Circles are present but lighter. A hint of colour returning to cheeks. The relief of the story being published shows in her face.',
        intensity: 4,
      },
    ],
  },
];
