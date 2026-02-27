export interface HelpArticle {
  id: string;
  title: string;
  steps: string[];
  tip?: string;
  relatedIds?: string[];
}

export interface HelpSection {
  id: string;
  title: string;
  icon: string; // SVG path(s)
  articles: HelpArticle[];
}

export const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
    articles: [
      {
        id: 'create-project',
        title: 'Creating your first project',
        steps: [
          'From the Project Hub, tap [+ Create].',
          'Enter your production name.',
          'Select production type (Film, TV Series, Short, Commercial, Music Video, Other).',
          'Tap [Create Project].',
          'Your project is ready — upload a script or schedule to get started.',
        ],
        tip: 'You can always change the production name and type later in Project Settings.',
        relatedIds: ['join-project', 'upload-script'],
      },
      {
        id: 'join-project',
        title: 'Joining a project with a code',
        steps: [
          'Get the invite code from your HOD (format: ABC-1234).',
          'From the Project Hub, tap [Join].',
          'Enter the code exactly as given.',
          'Tap [Join Project].',
          'The project data will sync to your device.',
        ],
        tip: 'Make sure you have a stable internet connection when joining — initial sync may take a moment for large projects.',
        relatedIds: ['create-project'],
      },
      {
        id: 'upload-script',
        title: 'Uploading a script',
        steps: [
          'Open your project.',
          'Go to More, then Script.',
          'Tap [Upload Script].',
          'Select your script file (PDF, FDX, or Fountain).',
          'Wait for parsing — scenes and characters will be extracted automatically.',
          'Review and confirm the character list.',
        ],
        tip: 'PDF scripts with clear formatting work best. The parser detects scene headings, character names, and dialogue automatically.',
        relatedIds: ['upload-schedule', 'create-project'],
      },
      {
        id: 'upload-schedule',
        title: 'Uploading a schedule',
        steps: [
          'Open your project.',
          'Go to More, then Schedule.',
          'Tap [Upload Schedule].',
          'Select your schedule PDF.',
          'The app will extract shooting days, scenes, and cast.',
          'Review the parsed data.',
        ],
        tip: 'One-liner or stripboard PDF formats are supported. The schedule is processed in the background — you can keep working while it parses.',
        relatedIds: ['upload-script', 'today-screen'],
      },
    ],
  },
  {
    id: 'today-view',
    title: 'Today View',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
    articles: [
      {
        id: 'today-screen',
        title: 'Understanding the Today screen',
        steps: [
          'The Today view shows what\'s filming on the current shooting day.',
          'The top card displays call times: Unit Call, Lunch, Camera Wrap, Est. Wrap.',
          'Scene cards show each scene scheduled for the day.',
          'Status badges indicate progress: Upcoming (grey), In Progress (gold), Wrapped (green).',
          'Tap any scene to capture continuity.',
        ],
        tip: 'If no call sheet has been uploaded for the day, the Today tab will prompt you to upload one.',
        relatedIds: ['navigate-days', 'scene-status'],
      },
      {
        id: 'navigate-days',
        title: 'Navigating between shooting days',
        steps: [
          'Use the arrows next to the date to move between days.',
          'The "Day X" badge shows the shooting day number.',
          'You can also tap the date to open a calendar picker.',
        ],
        relatedIds: ['today-screen'],
      },
      {
        id: 'scene-status',
        title: 'Scene status meanings',
        steps: [
          'Upcoming: Scene hasn\'t been filmed yet.',
          'In Progress: Currently shooting.',
          'Wrapped: Scene is complete for the day.',
          'Tap the status dropdown on a scene card to change it.',
        ],
        relatedIds: ['today-screen', 'capture-photos'],
      },
    ],
  },
  {
    id: 'continuity-capture',
    title: 'Continuity Capture',
    icon: 'M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z',
    articles: [
      {
        id: 'capture-photos',
        title: 'Capturing photos',
        steps: [
          'Tap a scene from Today or Breakdown.',
          'Select the character you\'re capturing.',
          'Tap the angle placeholder (Front, Left, Right, Back).',
          'Camera opens — frame your shot and tap capture.',
          'Review and confirm the photo.',
          'Repeat for all required angles.',
        ],
        tip: 'Photos are saved locally first, then synced to the cloud. You\'ll never lose a photo even if you lose connection.',
        relatedIds: ['required-angles', 'add-notes'],
      },
      {
        id: 'required-angles',
        title: 'Required angles',
        steps: [
          'Front: Direct face-on view.',
          'Left: Left profile (their left, your right when facing them).',
          'Right: Right profile.',
          'Back: Back of head/body.',
          'Additional: For SFX, wounds, or detail shots.',
        ],
        tip: 'Completing all four main angles marks the character as fully captured for that scene.',
        relatedIds: ['capture-photos'],
      },
      {
        id: 'add-notes',
        title: 'Adding notes and flags',
        steps: [
          'Flags: Quick toggles for common states (sweat, blood, dirt, tears, wet hair, dishevelled).',
          'Hair notes: Products, styling, continuity concerns.',
          'Makeup notes: Products, techniques, touch-up needs.',
          'General notes: Anything else the next artist should know.',
        ],
        tip: 'Flags show up as coloured badges on scene cards so you can spot continuity issues at a glance.',
        relatedIds: ['capture-photos', 'view-captures'],
      },
      {
        id: 'view-captures',
        title: 'Viewing previous captures',
        steps: [
          'Open the scene and character.',
          'Scroll down to see all captured photos.',
          'Tap any photo to view full size.',
          'Previous captures from other shooting days are preserved.',
        ],
        relatedIds: ['capture-photos'],
      },
    ],
  },
  {
    id: 'characters-looks',
    title: 'Characters & Looks',
    icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
    articles: [
      {
        id: 'character-list',
        title: 'Viewing the character list',
        steps: [
          'Go to the Breakdown tab to see all characters grouped by scene.',
          'Characters are detected automatically from your script and schedule.',
          'Tap any character name to see their full continuity history.',
        ],
        relatedIds: ['understanding-looks'],
      },
      {
        id: 'understanding-looks',
        title: 'Understanding looks',
        steps: [
          'A "look" is a defined appearance for a character (e.g. "Day Look", "Gala Dress").',
          'Looks can be assigned to specific scenes.',
          'Go to the Lookbook tab to view and manage character looks.',
          'Each look can have reference photos and detailed notes.',
        ],
        relatedIds: ['character-list', 'assign-looks'],
      },
      {
        id: 'assign-looks',
        title: 'Assigning looks to scenes',
        steps: [
          'Open a character\'s look from the Lookbook tab.',
          'Tap "Assign to Scenes" to link a look to specific scenes.',
          'This helps track which look a character should have in each scene.',
        ],
        relatedIds: ['understanding-looks'],
      },
    ],
  },
  {
    id: 'timesheets',
    title: 'Timesheets',
    icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
    articles: [
      {
        id: 'log-hours',
        title: 'Logging daily hours',
        steps: [
          'Go to the Hours tab.',
          'Tap the day you want to log.',
          'Enter: Call time, Lunch start, Lunch end, Wrap time.',
          'The app calculates your hours automatically.',
          'Tap Save.',
        ],
        tip: 'You can edit previously logged days by tapping on them. Changes are synced automatically.',
        relatedIds: ['rate-card', 'bectu-calculations'],
      },
      {
        id: 'rate-card',
        title: 'Setting up your rate card',
        steps: [
          'Go to Hours, then tap Rate Card.',
          'Enter your daily rate.',
          'Select your contract type (10+1 or 11+1).',
          'Add kit rental if applicable.',
          'Save — all calculations will use these rates.',
        ],
        tip: 'Your rate card is stored locally and not shared with team members.',
        relatedIds: ['log-hours', 'bectu-calculations'],
      },
      {
        id: 'bectu-calculations',
        title: 'Understanding BECTU calculations',
        steps: [
          'Base hours: Your contracted day (10 or 11 hours).',
          'Overtime: Hours beyond your base, calculated at premium rates.',
          'Sixth day: Premium rate for working 6 days in a week.',
          'Broken turnaround: Compensation if you don\'t get minimum rest.',
          'Broken lunch: Compensation if lunch is delayed.',
        ],
        relatedIds: ['rate-card', 'export-timesheets'],
      },
      {
        id: 'export-timesheets',
        title: 'Exporting timesheets',
        steps: [
          'Go to Hours, then tap Sheet view.',
          'Review your weekly summary.',
          'Tap the export icon (top right).',
          'Choose PDF or CSV.',
          'Share or save the file.',
        ],
        relatedIds: ['log-hours'],
      },
    ],
  },
  {
    id: 'budget-expenses',
    title: 'Budget & Expenses',
    icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
    articles: [
      {
        id: 'track-expenses',
        title: 'Tracking expenses',
        steps: [
          'Go to the Budget tab.',
          'Tap [+ Add Expense].',
          'Enter the amount, category, and description.',
          'Optionally attach a receipt photo.',
          'Tap Save.',
        ],
        relatedIds: ['scan-receipts', 'budget-summary'],
      },
      {
        id: 'scan-receipts',
        title: 'Scanning receipts',
        steps: [
          'When adding an expense, tap the camera icon.',
          'Point your camera at the receipt.',
          'The app will capture and attach the image.',
          'You can review or retake before saving.',
        ],
        relatedIds: ['track-expenses'],
      },
      {
        id: 'budget-summary',
        title: 'Viewing budget summary',
        steps: [
          'The Budget tab shows a summary of all expenses.',
          'Expenses are grouped by category.',
          'The total at the top shows your overall spend.',
          'Tap any expense to view or edit its details.',
        ],
        relatedIds: ['track-expenses'],
      },
    ],
  },
  {
    id: 'team-collaboration',
    title: 'Team Collaboration',
    icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
    articles: [
      {
        id: 'invite-team',
        title: 'Inviting team members',
        steps: [
          'Go to More, then Settings, then Team.',
          'Tap [Invite].',
          'Share the invite code with your team member.',
          'They enter the code in their app to join.',
        ],
        tip: 'Only project owners and supervisors can invite new members.',
        relatedIds: ['team-roles', 'how-sync-works'],
      },
      {
        id: 'team-roles',
        title: 'Understanding roles',
        steps: [
          'Owner: Full control — can manage settings, invite/remove members, and delete the project.',
          'Supervisor: Can manage team members and project data.',
          'Designer: Can capture continuity, add looks, and log hours.',
          'Trainee: Read-only access with limited capture ability.',
        ],
        relatedIds: ['invite-team'],
      },
      {
        id: 'how-sync-works',
        title: 'How sync works',
        steps: [
          'All data syncs automatically when you have an internet connection.',
          'The sync indicator at the top of the screen shows your connection status.',
          'Green dot: Synced and up to date.',
          'Orange dot: Currently syncing changes.',
          'Red dot: Offline — changes saved locally and will sync when reconnected.',
        ],
        tip: 'Photos and PDFs sync in the background. You can keep working while large files upload.',
        relatedIds: ['data-not-syncing'],
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: 'M11.42 15.17l-5.384-3.101A2.25 2.25 0 004.883 15.6L9 18.75l.165.165a2.65 2.65 0 003.723-.108l.136-.149 5.572-6.332a2.25 2.25 0 00-.42-3.263l-.102-.074a2.25 2.25 0 00-2.728.24L12 12.75l-.58 2.42z',
    articles: [
      {
        id: 'data-not-syncing',
        title: 'Data not syncing',
        steps: [
          'Check your internet connection.',
          'Look for the sync status indicator at the top of the screen.',
          'Green dot = synced, Orange = syncing, Red = offline.',
          'Try pulling down to refresh.',
          'If stuck, go to Settings and tap Force Sync.',
        ],
        relatedIds: ['how-sync-works', 'photos-not-uploading'],
      },
      {
        id: 'photos-not-uploading',
        title: 'Photos not uploading',
        steps: [
          'Check your internet connection.',
          'Large photos may take longer on slow connections.',
          'Photos are saved locally first, then sync in the background.',
          'Check available storage space on your device.',
        ],
        relatedIds: ['data-not-syncing', 'app-slow'],
      },
      {
        id: 'app-slow',
        title: 'App running slowly',
        steps: [
          'Close other apps to free memory.',
          'Large projects (100+ scenes) may load slower initially.',
          'Try clearing cache in Settings (this won\'t delete your data).',
        ],
        relatedIds: ['clear-cache'],
      },
      {
        id: 'clear-cache',
        title: 'Clearing cache',
        steps: [
          'Go to Settings, then Clear Cache.',
          'This removes temporary files only.',
          'Your captures, timesheets, and project data are safe.',
          'You may need to re-download PDFs after clearing.',
        ],
        relatedIds: ['app-slow'],
      },
    ],
  },
];

// Flat lookup for quick article retrieval
const articleMap = new Map<string, HelpArticle>();
for (const section of helpSections) {
  for (const article of section.articles) {
    articleMap.set(article.id, article);
  }
}

export function getArticleById(id: string): HelpArticle | undefined {
  return articleMap.get(id);
}

export function searchHelp(query: string): HelpArticle[] {
  const lower = query.toLowerCase().trim();
  if (!lower) return [];

  const results: HelpArticle[] = [];
  for (const section of helpSections) {
    for (const article of section.articles) {
      const inTitle = article.title.toLowerCase().includes(lower);
      const inSteps = article.steps.some((s) => s.toLowerCase().includes(lower));
      const inTip = article.tip?.toLowerCase().includes(lower);
      if (inTitle || inSteps || inTip) {
        results.push(article);
      }
    }
  }
  return results;
}
