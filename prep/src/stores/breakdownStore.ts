import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/* ━━━ Types ━━━ */

export interface Scene {
  id: string;
  number: number;
  intExt: 'INT' | 'EXT';
  dayNight: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
  location: string;
  storyDay: string;
  timeInfo: string;
  characterIds: string[];
  synopsis: string;
  scriptContent: string;
}

export type CharacterCategory = 'principal' | 'supporting_artist';

export interface Character {
  id: string;
  name: string;
  billing: number;
  category: CharacterCategory;
  age: string;
  gender: string;
  hairColour: string;
  hairType: string;
  eyeColour: string;
  skinTone: string;
  build: string;
  distinguishingFeatures: string;
  notes: string;
}

export interface Look {
  id: string;
  characterId: string;
  name: string;
  description: string;
  hair: string;
  makeup: string;
  wardrobe: string;
}

export interface HMWEntry {
  hair: string;
  makeup: string;
  wardrobe: string;
}

export interface CharacterBreakdown {
  characterId: string;
  lookId: string;
  entersWith: HMWEntry;
  sfx: string;
  changeType: 'no-change' | 'change';
  changeNotes: string;
  exitsWith: HMWEntry;
  notes: string;
}

export interface ProgressionStage {
  id: string;
  scene: string;
  stage: string;
  notes: string;
}

export interface ContinuityEvent {
  id: string;
  type: string;
  characterId: string;
  description: string;
  sceneRange: string;
  name?: string;
  stage?: string;
  scenes?: string[];
  products?: string;
  progression?: ProgressionStage[];
}

export interface ContinuityFlags {
  sweat: boolean;
  dishevelled: boolean;
  blood: boolean;
  dirt: boolean;
  wetHair: boolean;
  tears: boolean;
}

export const STAGE_SUGGESTIONS = [
  'Fresh', 'Day 1 Healing', 'Day 2 Healing', 'Day 3 Healing',
  'Scabbed', 'Faded', 'Healed',
] as const;

export interface SceneBreakdown {
  sceneId: string;
  timeline: { day: string; time: string; type: string; note: string };
  characters: CharacterBreakdown[];
  continuityEvents: ContinuityEvent[];
}

/* ━━━ Script Tags ━━━ */

export interface ScriptTag {
  id: string;
  sceneId: string;
  /** Character offset within the scene's scriptContent */
  startOffset: number;
  endOffset: number;
  text: string;
  /** Category id from BREAKDOWN_CATEGORIES (e.g. 'cast', 'hair', 'makeup') */
  categoryId: string;
  /** Optional character assignment — links this tag to a character's profile */
  characterId?: string;
  /** Optional description/note for this tag */
  description?: string;
}

/* ━━━ Continuity event types ━━━ */

export const CONTINUITY_EVENT_TYPES = ['Wound', 'Bruise', 'Prosthetic', 'Scar', 'Tattoo', 'Other'] as const;

/* ━━━ Category colours ━━━ */

export const BREAKDOWN_CATEGORIES = [
  { id: 'cast', label: 'Cast', color: '#6ba3f7' },
  { id: 'hair', label: 'Hair', color: '#D4943A' },
  { id: 'makeup', label: 'Makeup', color: '#F2C4A0' },
  { id: 'sfx', label: 'SFX', color: '#ef4444' },
  { id: 'health', label: 'Health', color: '#4ABFB0' },
  { id: 'injuries', label: 'Injuries', color: '#f97316' },
  { id: 'stunts', label: 'Stunts', color: '#a855f7' },
  { id: 'weather', label: 'Weather', color: '#38bdf8' },
  { id: 'wardrobe', label: 'Wardrobe', color: '#ec4899' },
  { id: 'extras', label: 'Extras', color: '#78716c' },
];

/* ━━━ Mock Characters ━━━ */

export const MOCK_CHARACTERS: Character[] = [
  {
    id: 'c1', name: 'SARAH CHEN', billing: 1, category: 'principal', age: '32', gender: 'Female',
    hairColour: 'Black', hairType: 'Straight, shoulder-length', eyeColour: 'Dark Brown',
    skinTone: 'Light', build: 'Athletic', distinguishingFeatures: 'Small scar above left eyebrow',
    notes: 'Lead detective. Badge on belt. Left-handed.',
  },
  {
    id: 'c2', name: 'MARCUS WEBB', billing: 2, category: 'principal', age: '42', gender: 'Male',
    hairColour: 'Dark Brown with grey temples', hairType: 'Short, cropped', eyeColour: 'Hazel',
    skinTone: 'Medium', build: 'Stocky, broad shoulders', distinguishingFeatures: 'Wedding ring, reading glasses on chain',
    notes: "Sarah's partner. Former military. Calm under pressure.",
  },
  {
    id: 'c3', name: 'DETECTIVE ROSA', billing: 3, category: 'principal', age: '55', gender: 'Female',
    hairColour: 'Silver-grey', hairType: 'Short bob', eyeColour: 'Green',
    skinTone: 'Olive', build: 'Average', distinguishingFeatures: 'Always wears pearl earrings',
    notes: 'Senior detective. Mentor to Sarah. 30 years on the force.',
  },
  {
    id: 'c4', name: 'JAMES HOLLOWAY', billing: 4, category: 'principal', age: '35', gender: 'Male',
    hairColour: 'Sandy blonde', hairType: 'Medium length, styled back', eyeColour: 'Blue',
    skinTone: 'Fair', build: 'Lean, tall', distinguishingFeatures: 'Expensive watch, tailored clothes',
    notes: 'Primary suspect. Tech entrepreneur. Charming exterior.',
  },
  {
    id: 'c5', name: 'ELENA VASQUEZ', billing: 5, category: 'principal', age: '28', gender: 'Female',
    hairColour: 'Dark brown', hairType: 'Long, wavy', eyeColour: 'Brown',
    skinTone: 'Warm', build: 'Petite', distinguishingFeatures: 'Tattoo on inner wrist (crescent moon)',
    notes: 'Key witness. Works at the coffee shop. Nervous disposition.',
  },
];

/* ━━━ Mock Looks ━━━ */

export const MOCK_LOOKS: Look[] = [
  // Sarah — 3 looks
  { id: 'l1', characterId: 'c1', name: 'Detective Professional', description: 'Standard work attire',
    hair: 'Low ponytail, clean', makeup: 'Minimal — foundation, subtle lip', wardrobe: 'Dark blazer, white shirt, dark trousers, badge on belt' },
  { id: 'l2', characterId: 'c1', name: 'Off Duty', description: 'Casual relaxed look',
    hair: 'Down, natural, slightly messy', makeup: 'None', wardrobe: 'Oversized sweater, jeans, sneakers' },
  { id: 'l3', characterId: 'c1', name: 'Undercover', description: 'Disguise for surveillance op',
    hair: 'Under a beanie, tucked', makeup: 'Heavier eye makeup, darker lip', wardrobe: 'Leather jacket, dark jeans, boots' },
  // Marcus — 2 looks
  { id: 'l4', characterId: 'c2', name: 'Suit & Tie', description: 'Professional detective attire',
    hair: 'Neat, groomed', makeup: 'Powder for shine', wardrobe: 'Charcoal suit, burgundy tie, polished shoes' },
  { id: 'l5', characterId: 'c2', name: 'Casual Weekend', description: 'Off-duty look',
    hair: 'Same but relaxed', makeup: 'N/A', wardrobe: 'Henley shirt, khakis, loafers' },
  // Rosa — 1 look
  { id: 'l6', characterId: 'c3', name: 'Command Presence', description: 'Senior detective formal',
    hair: 'Silver bob, perfectly styled', makeup: 'Subtle foundation, neutral lip', wardrobe: 'Navy pantsuit, pearl earrings, low heels' },
  // James — 1 look
  { id: 'l7', characterId: 'c4', name: 'Tech CEO', description: 'Polished executive',
    hair: 'Styled back, product', makeup: 'Concealer under eyes, powder', wardrobe: 'Slim-fit suit, no tie, expensive loafers' },
  // Elena — 1 look
  { id: 'l8', characterId: 'c5', name: 'Barista', description: 'Coffee shop uniform',
    hair: 'Loose waves, half up', makeup: 'Light mascara, lip balm', wardrobe: 'Apron over t-shirt, jeans, converse' },
];

/* ━━━ Mock Scenes ━━━ */

export const MOCK_SCENES: Scene[] = [
  {
    id: 's1', number: 1, intExt: 'INT', dayNight: 'NIGHT',
    location: 'POLICE STATION - INTERROGATION ROOM',
    storyDay: 'Day 1', timeInfo: '11:30 PM',
    characterIds: ['c1', 'c2', 'c3'],
    synopsis: 'Sarah and Marcus interrogate a witness while Rosa monitors from behind the glass.',
    scriptContent: `The room is stark — fluorescent light, steel table, two chairs on each side. A clock reads 11:32 PM.

SARAH CHEN sits across from an empty chair, case file open. She studies a photograph.

MARCUS WEBB enters carrying two paper cups of coffee. He sets one in front of Sarah.

                    MARCUS
          Forensics came back on the
          fibers. Matches his car.

                    SARAH
          That puts him at the scene.
              (beat)
          Where's Rosa?

CUT TO:

Behind the one-way mirror, DETECTIVE ROSA watches intently, arms folded.

                    DETECTIVE ROSA
              (into radio)
          Bring him in. Room two.`,
  },
  {
    id: 's2', number: 2, intExt: 'EXT', dayNight: 'DAY',
    location: 'CITY STREET - DOWNTOWN',
    storyDay: 'Day 1', timeInfo: '8:00 AM',
    characterIds: ['c1', 'c2'],
    synopsis: "Sarah and Marcus survey the crime scene outside the victim's office building.",
    scriptContent: `Morning sunlight cuts between tall buildings. Yellow crime scene tape flutters in the breeze.

SARAH CHEN ducks under the tape, badge out. MARCUS WEBB follows, pulling on latex gloves.

                    SARAH
          Who found the body?

                    MARCUS
          Building security. Six AM
          rounds. Back entrance.

Sarah crouches near a chalk outline, examining the pavement.

                    SARAH
          No blood spatter. He wasn't
          killed here.
              (stands)
          This is a dump site.

She looks up at the surrounding buildings, noting the security cameras.

                    MARCUS
          I'll pull the CCTV footage.
          Every camera in a three-block
          radius.`,
  },
  {
    id: 's3', number: 3, intExt: 'INT', dayNight: 'NIGHT',
    location: "SARAH'S APARTMENT - LIVING ROOM",
    storyDay: 'Day 1', timeInfo: '2:00 AM',
    characterIds: ['c1'],
    synopsis: 'Sarah works the case alone at home, unable to sleep.',
    scriptContent: `A small apartment, lived-in but sparse. Case files spread across the coffee table. An untouched glass of wine sits beside them.

SARAH CHEN, in sweats and a t-shirt, paces while studying a photograph. Her phone BUZZES.

She glances at it — "MARCUS: Go to sleep." — and sets it down.

                    SARAH (V.O.)
          Three victims. Same MO. Same
          neighborhood. But no connection
          between them. None that we can
          see.

She pins a new photo to the corkboard on her wall. Steps back. The board is covered in photos, maps, string.

                    SARAH
              (to herself)
          What am I missing?

Her gaze falls on a name written in red marker: HOLLOWAY.`,
  },
  {
    id: 's4', number: 4, intExt: 'INT', dayNight: 'DAY',
    location: 'COFFEE SHOP',
    storyDay: 'Day 2', timeInfo: '10:30 AM',
    characterIds: ['c1', 'c4', 'c5'],
    synopsis: "Sarah encounters James at Elena's coffee shop. Tension as she studies the suspect in his element.",
    scriptContent: `A warm, busy coffee shop. Morning rush. ELENA VASQUEZ works the espresso machine with practiced efficiency.

SARAH CHEN enters in her detective blazer. She scans the room and spots JAMES HOLLOWAY at a corner table, laptop open, looking every bit the successful tech CEO.

                    ELENA
          What can I get you?

                    SARAH
          Just a black coffee. Thanks.

Sarah pays, eyes still on James. Elena follows her gaze nervously.

                    ELENA
              (quietly)
          He comes in every morning.
          Same table. Same order.

                    SARAH
          How long has he been here today?

                    ELENA
          Since we opened. Seven AM.

James looks up from his laptop and catches Sarah watching him. He smiles — confident, unbothered.

                    JAMES
          Detective Chen, right? I heard
          you've been asking about me.
              (gestures to chair)
          Why don't you sit down?`,
  },
  {
    id: 's5', number: 5, intExt: 'EXT', dayNight: 'DAY',
    location: 'PARK - WALKING PATH',
    storyDay: 'Day 2', timeInfo: '1:00 PM',
    characterIds: ['c2', 'c5'],
    synopsis: 'Marcus meets Elena in the park for an off-the-record conversation about James.',
    scriptContent: `A quiet walking path through a tree-lined park. Dappled sunlight. Few people around.

MARCUS WEBB sits on a bench, reading glasses on, pretending to read a newspaper. ELENA VASQUEZ approaches, clearly nervous, clutching a paper bag.

                    ELENA
          You said no one would know.

                    MARCUS
          No one will. Sit down. You're
          drawing attention.

Elena sits, leaving space between them.

                    ELENA
          He knows something's off. He
          asked me if anyone had been
          asking questions.

                    MARCUS
          What did you tell him?

                    ELENA
          Nothing. But he looked at me
          like... like he already knew.`,
  },
  {
    id: 's6', number: 6, intExt: 'INT', dayNight: 'DAY',
    location: 'POLICE STATION - BULLPEN',
    storyDay: 'Day 3', timeInfo: '9:00 AM',
    characterIds: ['c2', 'c3'],
    synopsis: 'Rosa briefs Marcus on new evidence that complicates the investigation.',
    scriptContent: `The bullpen buzzes with activity. Phones ring. Detectives move between desks.

DETECTIVE ROSA stands at a whiteboard covered in case details. MARCUS WEBB approaches with a tablet.

                    MARCUS
          The CCTV footage is in. You're
          gonna want to see this.

He holds up the tablet. Rosa leans in, expression hardening.

                    DETECTIVE ROSA
          That's not Holloway.

                    MARCUS
          No. But that jacket — that's
          the same one from the fiber
          analysis.

                    DETECTIVE ROSA
          Someone's setting him up.
              (beat)
          Or he's not working alone.`,
  },
  {
    id: 's7', number: 7, intExt: 'INT', dayNight: 'DAY',
    location: "JAMES'S OFFICE - TECH STARTUP HQ",
    storyDay: 'Day 3', timeInfo: '2:00 PM',
    characterIds: ['c4'],
    synopsis: 'James alone in his office, making a suspicious phone call.',
    scriptContent: `A sleek, modern office. Floor-to-ceiling windows. The city sprawls below.

JAMES HOLLOWAY stands at the window, phone to his ear. His confident facade has cracks.

                    JAMES
          No, listen to me. The detective
          was at the coffee shop. Chen.
          She's good.
              (listens)
          I don't care what the lawyer
          said. They have the fibers.

He loosens his tie, runs a hand through his hair.

                    JAMES (CONT'D)
          We need to move up the timeline.
          Tonight.
              (pause)
          Then make sure she doesn't.

He hangs up. Stares at his reflection in the glass. For a moment, the mask slips — we see fear.`,
  },
  {
    id: 's8', number: 8, intExt: 'EXT', dayNight: 'NIGHT',
    location: 'ALLEY - BEHIND THE COFFEE SHOP',
    storyDay: 'Day 3', timeInfo: '10:00 PM',
    characterIds: ['c1', 'c4'],
    synopsis: 'Sarah confronts James in the alley. A dangerous encounter.',
    scriptContent: `A narrow alley, poorly lit. Dumpsters line one wall. A single streetlight flickers at the far end.

SARAH CHEN moves carefully down the alley, hand near her holster. She hears footsteps.

JAMES HOLLOWAY steps out from behind a dumpster, hands visible.

                    JAMES
          Before you reach for that gun,
          Detective — I'm here to help.

                    SARAH
          Help? You're a suspect in three
          murders.

                    JAMES
          I didn't kill anyone. But I
          know who did.

A SOUND from deeper in the alley. Both freeze.

                    SARAH
          Who else is here?

                    JAMES
              (urgent, quiet)
          That's what I'm trying to tell
          you. We need to leave. Now.`,
  },
  {
    id: 's9', number: 9, intExt: 'INT', dayNight: 'DAY',
    location: 'HOSPITAL - WAITING ROOM',
    storyDay: 'Day 4', timeInfo: '6:00 AM',
    characterIds: ['c1', 'c2', 'c5'],
    synopsis: 'After the alley incident. Sarah has minor injuries. Marcus and Elena wait.',
    scriptContent: `Harsh hospital lighting. The smell of antiseptic. A TV murmurs in the corner.

MARCUS WEBB paces the waiting room. ELENA VASQUEZ sits in a plastic chair, mascara streaked, hands shaking.

                    MARCUS
          She's tough. She'll be fine.

                    ELENA
          This is my fault. I should
          have told you sooner about—

                    MARCUS
          Don't. Not here.

SARAH CHEN emerges from a treatment room, butterfly bandage above her eyebrow, arm in a sling.

                    SARAH
          It's a sprain. Nothing broken.
              (to Elena)
          I need you to tell me everything.
          Right now. No more half-truths.

Elena looks at Marcus. He nods.`,
  },
  {
    id: 's10', number: 10, intExt: 'EXT', dayNight: 'NIGHT',
    location: 'ROOFTOP - DOWNTOWN BUILDING',
    storyDay: 'Day 5', timeInfo: '9:00 PM',
    characterIds: ['c1', 'c3'],
    synopsis: 'Sarah and Rosa surveil from a rooftop. Rosa shares a personal revelation.',
    scriptContent: `City lights spread to the horizon. Wind whips across the rooftop.

SARAH CHEN and DETECTIVE ROSA crouch behind a parapet wall, binoculars trained on a building across the street.

                    DETECTIVE ROSA
          Third floor. Corner office.
          Light just came on.

                    SARAH
          That's his. Same time every
          night this week.

A long silence. Rosa lowers her binoculars.

                    DETECTIVE ROSA
          Sarah... there's something I
          should have told you. About
          the first victim.
              (beat)
          I knew him. Twenty years ago.
          Before the force.

                    SARAH
          Rosa—

                    DETECTIVE ROSA
          I'm not compromised. But you
          deserve to know.`,
  },
  {
    id: 's11', number: 11, intExt: 'INT', dayNight: 'DAY',
    location: 'COURTHOUSE - HALLWAY',
    storyDay: 'Day 8', timeInfo: '10:00 AM',
    characterIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
    synopsis: 'All characters converge at the courthouse. Tensions run high before the hearing.',
    scriptContent: `A wide marble hallway. Footsteps echo. Lawyers in suits pass in both directions.

SARAH CHEN and MARCUS WEBB stand near a courtroom door, reviewing papers.

JAMES HOLLOWAY approaches with his LAWYER, looking composed but pale.

                    JAMES
          Detective Chen. No hard
          feelings about the alley.

                    SARAH
          Save it for the judge.

DETECTIVE ROSA arrives, expression grim. She pulls Sarah aside.

                    DETECTIVE ROSA
              (low)
          The DA's wavering. Says the
          evidence is circumstantial.

ELENA VASQUEZ enters through the main doors, dressed formally, clutching a folder to her chest.

                    ELENA
          I have something. Security
          footage from my own phone.
          He didn't see me recording.

Everyone turns to look at her.`,
  },
  {
    id: 's12', number: 12, intExt: 'EXT', dayNight: 'DAY',
    location: 'CEMETERY',
    storyDay: 'Day 10', timeInfo: '3:00 PM',
    characterIds: ['c1', 'c2'],
    synopsis: "Sarah and Marcus visit the victims' graves. Quiet resolution.",
    scriptContent: `An overcast day. A hillside cemetery overlooking the city. Three fresh graves in a row.

SARAH CHEN stands before the graves, badge in her hand. She runs her thumb over it.

MARCUS WEBB stands a few paces back, giving her space.

                    SARAH
          Three people. Three lives.
          Because someone decided they
          were in the way.

                    MARCUS
          We got him, Sarah.

                    SARAH
          Did we? We got Holloway. But
          the person on that phone call...

She pockets her badge and turns to Marcus.

                    SARAH (CONT'D)
          It's not over.

                    MARCUS
          Then we keep going.

They walk together toward the car. The city skyline looms in the distance.

                                      FADE OUT.`,
  },
];

/* ━━━ Initial breakdown data (scene 1 complete, 2-4 partial, 5-12 empty) ━━━ */

export const emptyHMW = (): HMWEntry => ({ hair: '', makeup: '', wardrobe: '' });

const INITIAL_BREAKDOWNS: Record<string, SceneBreakdown> = {
  // Scene 1 — fully complete
  s1: {
    sceneId: 's1',
    timeline: { day: 'Day 1', time: 'Night', type: 'Normal', note: 'Late shift interrogation' },
    characters: [
      {
        characterId: 'c1', lookId: 'l1',
        entersWith: { hair: 'Low ponytail, clean', makeup: 'Minimal foundation, no lip', wardrobe: 'Dark blazer, white shirt, badge on belt' },
        sfx: '',
        changeType: 'no-change', changeNotes: '',
        exitsWith: { hair: 'Low ponytail, clean', makeup: 'Minimal foundation, no lip', wardrobe: 'Dark blazer, white shirt, badge on belt' },
        notes: 'End of a long shift — slight fatigue under eyes',
      },
      {
        characterId: 'c2', lookId: 'l4',
        entersWith: { hair: 'Neat, groomed', makeup: 'Powder for shine', wardrobe: 'Charcoal suit, no tie, sleeves rolled' },
        sfx: '',
        changeType: 'no-change', changeNotes: '',
        exitsWith: { hair: 'Neat, groomed', makeup: 'Powder for shine', wardrobe: 'Charcoal suit, no tie, sleeves rolled' },
        notes: 'Carrying two coffees on entry',
      },
      {
        characterId: 'c3', lookId: 'l6',
        entersWith: { hair: 'Silver bob, styled', makeup: 'Subtle foundation, neutral lip', wardrobe: 'Navy pantsuit, pearl earrings' },
        sfx: '',
        changeType: 'no-change', changeNotes: '',
        exitsWith: { hair: 'Silver bob, styled', makeup: 'Subtle foundation, neutral lip', wardrobe: 'Navy pantsuit, pearl earrings' },
        notes: 'Behind one-way mirror. Radio earpiece visible.',
      },
    ],
    continuityEvents: [],
  },
  // Scene 2 — partial (Sarah filled, Marcus empty)
  s2: {
    sceneId: 's2',
    timeline: { day: 'Day 1', time: 'Day', type: 'Normal', note: '' },
    characters: [
      {
        characterId: 'c1', lookId: 'l1',
        entersWith: { hair: 'Low ponytail, clean', makeup: 'Minimal foundation', wardrobe: 'Dark blazer, badge visible' },
        sfx: '',
        changeType: 'no-change', changeNotes: '',
        exitsWith: { hair: 'Low ponytail, clean', makeup: 'Minimal foundation', wardrobe: 'Dark blazer, badge visible' },
        notes: '',
      },
      {
        characterId: 'c2', lookId: '',
        entersWith: emptyHMW(), sfx: '',
        changeType: 'no-change', changeNotes: '',
        exitsWith: emptyHMW(), notes: '',
      },
    ],
    continuityEvents: [],
  },
  // Scene 3 — partial (timeline only)
  s3: {
    sceneId: 's3',
    timeline: { day: 'Day 1', time: 'Night', type: 'Normal', note: 'Late — after scene 1' },
    characters: [
      {
        characterId: 'c1', lookId: 'l2',
        entersWith: emptyHMW(), sfx: '',
        changeType: 'no-change', changeNotes: '',
        exitsWith: emptyHMW(), notes: '',
      },
    ],
    continuityEvents: [],
  },
  // Scene 4 — partial (some data)
  s4: {
    sceneId: 's4',
    timeline: { day: 'Day 2', time: 'Day', type: 'Normal', note: '' },
    characters: [
      {
        characterId: 'c1', lookId: 'l1',
        entersWith: { hair: 'Low ponytail', makeup: 'Minimal', wardrobe: '' },
        sfx: '', changeType: 'no-change', changeNotes: '',
        exitsWith: emptyHMW(), notes: '',
      },
      {
        characterId: 'c4', lookId: '',
        entersWith: emptyHMW(), sfx: '',
        changeType: 'no-change', changeNotes: '',
        exitsWith: emptyHMW(), notes: '',
      },
      {
        characterId: 'c5', lookId: '',
        entersWith: emptyHMW(), sfx: '',
        changeType: 'no-change', changeNotes: '',
        exitsWith: emptyHMW(), notes: '',
      },
    ],
    continuityEvents: [],
  },
};

/* ━━━ Store ━━━ */

interface BreakdownState {
  breakdowns: Record<string, SceneBreakdown>;
  getBreakdown: (sceneId: string) => SceneBreakdown | undefined;
  setBreakdown: (sceneId: string, data: SceneBreakdown) => void;
  updateTimeline: (sceneId: string, timeline: SceneBreakdown['timeline']) => void;
  updateCharacterBreakdown: (sceneId: string, characterId: string, data: Partial<CharacterBreakdown>) => void;
  addContinuityEvent: (sceneId: string, event: ContinuityEvent) => void;
  updateContinuityEvent: (sceneId: string, eventId: string, data: Partial<ContinuityEvent>) => void;
  removeContinuityEvent: (sceneId: string, eventId: string) => void;
  removeCharacterBreakdown: (sceneId: string, characterId: string) => void;
  removeCharacterFromAllBreakdowns: (characterId: string) => void;
  mergeCharacterBreakdowns: (sourceCharacterId: string, targetCharacterId: string) => void;
  getCompletionStatus: (sceneId: string, scene: Scene) => 'empty' | 'partial' | 'complete';
}

export const useBreakdownStore = create<BreakdownState>()(
  persist(
    (set, get) => ({
      breakdowns: { ...INITIAL_BREAKDOWNS },

      getBreakdown: (sceneId) => get().breakdowns[sceneId],

      setBreakdown: (sceneId, data) =>
        set((s) => ({ breakdowns: { ...s.breakdowns, [sceneId]: data } })),

      updateTimeline: (sceneId, timeline) =>
        set((s) => {
          const existing = s.breakdowns[sceneId];
          if (!existing) return s;
          return { breakdowns: { ...s.breakdowns, [sceneId]: { ...existing, timeline } } };
        }),

      updateCharacterBreakdown: (sceneId, characterId, data) =>
        set((s) => {
          const existing = s.breakdowns[sceneId];
          if (!existing) return s;
          const characters = existing.characters.map((c) =>
            c.characterId === characterId ? { ...c, ...data } : c
          );
          return { breakdowns: { ...s.breakdowns, [sceneId]: { ...existing, characters } } };
        }),

      addContinuityEvent: (sceneId, event) =>
        set((s) => {
          const existing = s.breakdowns[sceneId];
          if (!existing) return s;
          return {
            breakdowns: {
              ...s.breakdowns,
              [sceneId]: { ...existing, continuityEvents: [...existing.continuityEvents, event] },
            },
          };
        }),

      updateContinuityEvent: (sceneId, eventId, data) =>
        set((s) => {
          const existing = s.breakdowns[sceneId];
          if (!existing) return s;
          return {
            breakdowns: {
              ...s.breakdowns,
              [sceneId]: {
                ...existing,
                continuityEvents: existing.continuityEvents.map((e) =>
                  e.id === eventId ? { ...e, ...data } : e
                ),
              },
            },
          };
        }),

      removeContinuityEvent: (sceneId, eventId) =>
        set((s) => {
          const existing = s.breakdowns[sceneId];
          if (!existing) return s;
          return {
            breakdowns: {
              ...s.breakdowns,
              [sceneId]: {
                ...existing,
                continuityEvents: existing.continuityEvents.filter((e) => e.id !== eventId),
              },
            },
          };
        }),

      removeCharacterBreakdown: (sceneId, characterId) =>
        set((s) => {
          const existing = s.breakdowns[sceneId];
          if (!existing) return s;
          return {
            breakdowns: {
              ...s.breakdowns,
              [sceneId]: {
                ...existing,
                characters: existing.characters.filter((c) => c.characterId !== characterId),
                continuityEvents: existing.continuityEvents.filter((e) => e.characterId !== characterId),
              },
            },
          };
        }),

      removeCharacterFromAllBreakdowns: (characterId) =>
        set((s) => {
          const updated: Record<string, SceneBreakdown> = {};
          for (const [key, bd] of Object.entries(s.breakdowns)) {
            updated[key] = {
              ...bd,
              characters: bd.characters.filter((c) => c.characterId !== characterId),
              continuityEvents: bd.continuityEvents.filter((e) => e.characterId !== characterId),
            };
          }
          return { breakdowns: updated };
        }),

      mergeCharacterBreakdowns: (sourceCharacterId, targetCharacterId) =>
        set((s) => {
          const updated: Record<string, SceneBreakdown> = {};
          for (const [key, bd] of Object.entries(s.breakdowns)) {
            const hasTarget = bd.characters.some((c) => c.characterId === targetCharacterId);
            updated[key] = {
              ...bd,
              characters: hasTarget
                ? bd.characters.filter((c) => c.characterId !== sourceCharacterId)
                : bd.characters.map((c) => c.characterId === sourceCharacterId ? { ...c, characterId: targetCharacterId } : c),
              continuityEvents: bd.continuityEvents.map((e) =>
                e.characterId === sourceCharacterId ? { ...e, characterId: targetCharacterId } : e
              ),
            };
          }
          return { breakdowns: updated };
        }),

      getCompletionStatus: (sceneId, scene) => {
        const bd = get().breakdowns[sceneId];
        if (!bd) return 'empty';
        const hasTimeline = bd.timeline.day || bd.timeline.time;
        const filledChars = bd.characters.filter((c) => {
          const hasLook = !!c.lookId;
          const hasEntry = c.entersWith.hair || c.entersWith.makeup || c.entersWith.wardrobe;
          return hasLook || hasEntry;
        });
        if (!hasTimeline && filledChars.length === 0) return 'empty';
        if (filledChars.length === scene.characterIds.length && hasTimeline) {
          const allComplete = bd.characters.every((c) => {
            return c.lookId && c.entersWith.hair && c.entersWith.makeup && c.entersWith.wardrobe
              && c.exitsWith.hair && c.exitsWith.makeup && c.exitsWith.wardrobe;
          });
          if (allComplete) return 'complete';
        }
        return 'partial';
      },
    }),
    {
      name: 'prep-happy-breakdowns',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/* ━━━ Script Tag Store ━━━ */

interface TagState {
  tags: ScriptTag[];
  addTag: (tag: ScriptTag) => void;
  removeTag: (id: string) => void;
  updateTag: (id: string, data: Partial<ScriptTag>) => void;
  getTagsForScene: (sceneId: string) => ScriptTag[];
  getTagsForCharacter: (characterId: string) => ScriptTag[];
}

export const useTagStore = create<TagState>()(
  persist(
    (set, get) => ({
      tags: [],

      addTag: (tag) =>
        set((s) => ({ tags: [...s.tags, tag] })),

      removeTag: (id) =>
        set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),

      updateTag: (id, data) =>
        set((s) => ({
          tags: s.tags.map((t) => (t.id === id ? { ...t, ...data } : t)),
        })),

      getTagsForScene: (sceneId) =>
        get().tags.filter((t) => t.sceneId === sceneId),

      getTagsForCharacter: (characterId) =>
        get().tags.filter((t) => t.characterId === characterId),
    }),
    {
      name: 'prep-happy-tags',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/* ━━━ Synopsis Store — shared editable synopses ━━━ */

interface SynopsisState {
  synopses: Record<string, string>;
  getSynopsis: (sceneId: string, fallback: string) => string;
  setSynopsis: (sceneId: string, text: string) => void;
}

export const useSynopsisStore = create<SynopsisState>()(
  persist(
    (set, get) => ({
      synopses: {},

      getSynopsis: (sceneId, fallback) => {
        const val = get().synopses[sceneId];
        return val !== undefined ? val : fallback;
      },

      setSynopsis: (sceneId, text) =>
        set((s) => ({ synopses: { ...s.synopses, [sceneId]: text } })),
    }),
    {
      name: 'prep-happy-synopses',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/* ━━━ Scene Metadata Store — editable overrides for auto-detected scene heading fields ━━━ */

export interface SceneMeta {
  intExt?: 'INT' | 'EXT';
  dayNight?: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
  location?: string;
}

interface SceneMetaState {
  overrides: Record<string, SceneMeta>;
  getMeta: (sceneId: string, fallback: Scene) => { intExt: Scene['intExt']; dayNight: Scene['dayNight']; location: string };
  setMeta: (sceneId: string, data: Partial<SceneMeta>) => void;
}

export const useSceneMetaStore = create<SceneMetaState>()(
  persist(
    (set, get) => ({
      overrides: {},

      getMeta: (sceneId, fallback) => {
        const o = get().overrides[sceneId];
        return {
          intExt: o?.intExt ?? fallback.intExt,
          dayNight: o?.dayNight ?? fallback.dayNight,
          location: o?.location ?? fallback.location,
        };
      },

      setMeta: (sceneId, data) =>
        set((s) => ({
          overrides: { ...s.overrides, [sceneId]: { ...s.overrides[sceneId], ...data } },
        })),
    }),
    {
      name: 'prep-happy-scene-meta',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/* ━━━ Continuity Tracker Store — scene-level flags and tracking ━━━ */

const emptyFlags = (): ContinuityFlags => ({
  sweat: false, dishevelled: false, blood: false,
  dirt: false, wetHair: false, tears: false,
});

export interface SceneContinuity {
  sceneId: string;
  characterId: string;
  flags: ContinuityFlags;
  notes: string;
  status: 'pending' | 'in-progress' | 'complete';
}

interface ContinuityTrackerState {
  entries: Record<string, SceneContinuity>; // key: `${sceneId}-${characterId}`
  getEntry: (sceneId: string, characterId: string) => SceneContinuity;
  setEntry: (sceneId: string, characterId: string, data: Partial<SceneContinuity>) => void;
  toggleFlag: (sceneId: string, characterId: string, flag: keyof ContinuityFlags) => void;
  setStatus: (sceneId: string, characterId: string, status: SceneContinuity['status']) => void;
  getSceneStatus: (sceneId: string, characterIds: string[]) => 'empty' | 'partial' | 'complete';
}

export const useContinuityTrackerStore = create<ContinuityTrackerState>()(
  persist(
    (set, get) => ({
      entries: {},

      getEntry: (sceneId, characterId) => {
        const key = `${sceneId}-${characterId}`;
        return get().entries[key] || {
          sceneId, characterId,
          flags: emptyFlags(),
          notes: '',
          status: 'pending' as const,
        };
      },

      setEntry: (sceneId, characterId, data) => {
        const key = `${sceneId}-${characterId}`;
        set((s) => ({
          entries: {
            ...s.entries,
            [key]: { ...s.entries[key] || { sceneId, characterId, flags: emptyFlags(), notes: '', status: 'pending' as const }, ...data },
          },
        }));
      },

      toggleFlag: (sceneId, characterId, flag) => {
        const key = `${sceneId}-${characterId}`;
        const existing = get().entries[key] || {
          sceneId, characterId, flags: emptyFlags(), notes: '', status: 'pending' as const,
        };
        set((s) => ({
          entries: {
            ...s.entries,
            [key]: { ...existing, flags: { ...existing.flags, [flag]: !existing.flags[flag] } },
          },
        }));
      },

      setStatus: (sceneId, characterId, status) => {
        const key = `${sceneId}-${characterId}`;
        const existing = get().entries[key] || {
          sceneId, characterId, flags: emptyFlags(), notes: '', status: 'pending' as const,
        };
        set((s) => ({
          entries: { ...s.entries, [key]: { ...existing, status } },
        }));
      },

      getSceneStatus: (sceneId, characterIds) => {
        const entries = characterIds.map((cid) => get().entries[`${sceneId}-${cid}`]);
        const filled = entries.filter((e) => e && (e.status !== 'pending' || e.notes || Object.values(e.flags).some(Boolean)));
        if (filled.length === 0) return 'empty';
        const allComplete = entries.every((e) => e?.status === 'complete');
        return allComplete ? 'complete' : 'partial';
      },
    }),
    {
      name: 'prep-happy-continuity-tracker',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/* ━━━ Continuity Photos Store ━━━ */

export type PhotoAngle = 'front' | 'left' | 'right' | 'back';

export interface ContinuityPhoto {
  id: string;
  /** object URL or data URL */
  url: string;
  filename: string;
  addedAt: string;
}

export interface SceneContinuityPhotos {
  /** Angle shots keyed by angle — one per slot */
  anglePhotos: Partial<Record<PhotoAngle, ContinuityPhoto>>;
  /** Master reference image */
  masterRef: ContinuityPhoto | null;
  /** Free-form additional photos */
  additional: ContinuityPhoto[];
}

const emptyScenePhotos = (): SceneContinuityPhotos => ({
  anglePhotos: {},
  masterRef: null,
  additional: [],
});

interface ContinuityPhotosState {
  /** key: `${sceneId}-${characterId}` */
  photos: Record<string, SceneContinuityPhotos>;
  getPhotos: (sceneId: string, characterId: string) => SceneContinuityPhotos;
  setAnglePhoto: (sceneId: string, characterId: string, angle: PhotoAngle, photo: ContinuityPhoto | null) => void;
  setMasterRef: (sceneId: string, characterId: string, photo: ContinuityPhoto | null) => void;
  addAdditionalPhoto: (sceneId: string, characterId: string, photo: ContinuityPhoto) => void;
  removeAdditionalPhoto: (sceneId: string, characterId: string, photoId: string) => void;
}

export const useContinuityPhotosStore = create<ContinuityPhotosState>()(
  persist(
    (set, get) => ({
      photos: {},

      getPhotos: (sceneId, characterId) => {
        const key = `${sceneId}-${characterId}`;
        return get().photos[key] || emptyScenePhotos();
      },

      setAnglePhoto: (sceneId, characterId, angle, photo) => {
        const key = `${sceneId}-${characterId}`;
        const existing = get().photos[key] || emptyScenePhotos();
        set((s) => ({
          photos: {
            ...s.photos,
            [key]: {
              ...existing,
              anglePhotos: { ...existing.anglePhotos, [angle]: photo ?? undefined },
            },
          },
        }));
      },

      setMasterRef: (sceneId, characterId, photo) => {
        const key = `${sceneId}-${characterId}`;
        const existing = get().photos[key] || emptyScenePhotos();
        set((s) => ({
          photos: { ...s.photos, [key]: { ...existing, masterRef: photo } },
        }));
      },

      addAdditionalPhoto: (sceneId, characterId, photo) => {
        const key = `${sceneId}-${characterId}`;
        const existing = get().photos[key] || emptyScenePhotos();
        set((s) => ({
          photos: {
            ...s.photos,
            [key]: { ...existing, additional: [...existing.additional, photo] },
          },
        }));
      },

      removeAdditionalPhoto: (sceneId, characterId, photoId) => {
        const key = `${sceneId}-${characterId}`;
        const existing = get().photos[key] || emptyScenePhotos();
        set((s) => ({
          photos: {
            ...s.photos,
            [key]: { ...existing, additional: existing.additional.filter((p) => p.id !== photoId) },
          },
        }));
      },
    }),
    {
      name: 'prep-happy-continuity-photos',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/* ━━━ Script Upload Store — tracks uploaded script file per project ━━━ */

export interface UploadedScript {
  projectId: string;
  filename: string;
  uploadedAt: string;
  sceneCount: number;
  rawText: string;
}

interface ScriptUploadState {
  scripts: Record<string, UploadedScript>; // keyed by projectId
  getScript: (projectId: string) => UploadedScript | undefined;
  setScript: (projectId: string, data: UploadedScript) => void;
  clearScript: (projectId: string) => void;
}

export const useScriptUploadStore = create<ScriptUploadState>()(
  persist(
    (set, get) => ({
      scripts: {},

      getScript: (projectId) => get().scripts[projectId],

      setScript: (projectId, data) =>
        set((s) => ({ scripts: { ...s.scripts, [projectId]: data } })),

      clearScript: (projectId) =>
        set((s) => {
          const { [projectId]: _, ...rest } = s.scripts;
          return { scripts: rest };
        }),
    }),
    {
      name: 'prep-happy-script-uploads',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/* ━━━ Parsed Script Store — persists parsed scenes & characters per project ━━━ */

export interface ParsedSceneData {
  id: string;
  number: number;
  intExt: 'INT' | 'EXT';
  dayNight: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
  location: string;
  storyDay: string;
  timeInfo: string;
  characterIds: string[];
  synopsis: string;
  scriptContent: string;
}

export interface ParsedCharacterData {
  id: string;
  name: string;
  billing: number;
  category: CharacterCategory;
  age: string;
  gender: string;
  hairColour: string;
  hairType: string;
  eyeColour: string;
  skinTone: string;
  build: string;
  distinguishingFeatures: string;
  notes: string;
}

interface ProjectParsedData {
  scenes: ParsedSceneData[];
  characters: ParsedCharacterData[];
  looks: Look[];
  filename: string;
  parsedAt: string;
}

interface ParsedScriptState {
  projects: Record<string, ProjectParsedData>; // keyed by projectId
  getParsedData: (projectId: string) => ProjectParsedData | undefined;
  setParsedData: (projectId: string, data: ProjectParsedData) => void;
  clearParsedData: (projectId: string) => void;
  updateCharacter: (projectId: string, characterId: string, data: Partial<ParsedCharacterData>) => void;
  removeCharacterFromScene: (projectId: string, sceneId: string, characterId: string) => void;
  removeCharacterEntirely: (projectId: string, characterId: string) => void;
  mergeCharacters: (projectId: string, sourceCharacterId: string, targetCharacterId: string) => void;
}

export const useParsedScriptStore = create<ParsedScriptState>()(
  persist(
    (set, get) => ({
      projects: {},

      getParsedData: (projectId) => get().projects[projectId],

      setParsedData: (projectId, data) =>
        set((s) => ({ projects: { ...s.projects, [projectId]: data } })),

      clearParsedData: (projectId) =>
        set((s) => {
          const { [projectId]: _, ...rest } = s.projects;
          return { projects: rest };
        }),

      updateCharacter: (projectId, characterId, data) =>
        set((s) => {
          const project = s.projects[projectId];
          if (!project) return s;
          const characters = project.characters.map((c) =>
            c.id === characterId ? { ...c, ...data } : c
          );
          return { projects: { ...s.projects, [projectId]: { ...project, characters } } };
        }),

      removeCharacterFromScene: (projectId, sceneId, characterId) =>
        set((s) => {
          const project = s.projects[projectId];
          if (!project) return s;
          const scenes = project.scenes.map((sc) =>
            sc.id === sceneId ? { ...sc, characterIds: sc.characterIds.filter((id) => id !== characterId) } : sc
          );
          return { projects: { ...s.projects, [projectId]: { ...project, scenes } } };
        }),

      removeCharacterEntirely: (projectId, characterId) =>
        set((s) => {
          const project = s.projects[projectId];
          if (!project) return s;
          const scenes = project.scenes.map((sc) => ({
            ...sc, characterIds: sc.characterIds.filter((id) => id !== characterId),
          }));
          const characters = project.characters.filter((c) => c.id !== characterId);
          const looks = project.looks.filter((l) => l.characterId !== characterId);
          return { projects: { ...s.projects, [projectId]: { ...project, scenes, characters, looks } } };
        }),

      mergeCharacters: (projectId, sourceCharacterId, targetCharacterId) =>
        set((s) => {
          const project = s.projects[projectId];
          if (!project) return s;
          const scenes = project.scenes.map((sc) => {
            const hasTarget = sc.characterIds.includes(targetCharacterId);
            const hasSource = sc.characterIds.includes(sourceCharacterId);
            if (!hasSource) return sc;
            if (hasTarget) return { ...sc, characterIds: sc.characterIds.filter((id) => id !== sourceCharacterId) };
            return { ...sc, characterIds: sc.characterIds.map((id) => id === sourceCharacterId ? targetCharacterId : id) };
          });
          const characters = project.characters.filter((c) => c.id !== sourceCharacterId);
          const looks = project.looks.filter((l) => l.characterId !== sourceCharacterId);
          return { projects: { ...s.projects, [projectId]: { ...project, scenes, characters, looks } } };
        }),
    }),
    {
      name: 'prep-happy-parsed-scripts',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/* ━━━ Character Overrides Store — editable character profile data ━━━ */

interface CharacterOverridesState {
  overrides: Record<string, Partial<Character>>; // keyed by character id
  getCharacter: (char: Character) => Character;
  updateCharacter: (characterId: string, data: Partial<Character>) => void;
}

export const useCharacterOverridesStore = create<CharacterOverridesState>()(
  persist(
    (set, get) => ({
      overrides: {},

      getCharacter: (char) => {
        const o = get().overrides[char.id];
        return o ? { ...char, ...o } : char;
      },

      updateCharacter: (characterId, data) =>
        set((s) => ({
          overrides: {
            ...s.overrides,
            [characterId]: { ...s.overrides[characterId], ...data },
          },
        })),
    }),
    {
      name: 'prep-happy-character-overrides',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
