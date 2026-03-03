import { useUIStore } from '@/stores/uiStore';
import { SceneList } from '@/components/breakdown/SceneList';
import { ScriptView } from '@/components/breakdown/ScriptView';
import { CharacterTabs } from '@/components/breakdown/CharacterTabs';
import { CharacterProfile } from '@/components/breakdown/CharacterProfile';
import { BreakdownPanel } from '@/components/breakdown/BreakdownPanel';

export function BreakdownPage() {
  const activeCenterTab = useUIStore((s) => s.activeCenterTab);

  return (
    <div className="h-full grid grid-cols-[250px_1fr_350px]">
      {/* Left Panel — Scene List */}
      <SceneList />

      {/* Center Panel — Script or Character Profile */}
      <div className="flex flex-col overflow-hidden">
        <CharacterTabs />
        <div className="flex-1 overflow-hidden">
          {activeCenterTab === 'script' ? (
            <ScriptView />
          ) : (
            <CharacterProfile />
          )}
        </div>
      </div>

      {/* Right Panel — Breakdown Form */}
      <BreakdownPanel />
    </div>
  );
}
