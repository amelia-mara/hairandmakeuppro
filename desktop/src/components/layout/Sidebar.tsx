import {
  LayoutDashboard,
  FileText,
  Users,
  Link,
  DollarSign,
  Clock,
  Settings,
  Download,
} from 'lucide-react';
import { Tooltip } from '@/components/ui';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  projectId?: string;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: FileText, label: 'Breakdown', path: '/breakdown' },
  { icon: Users, label: 'Characters', path: '/characters' },
  { icon: Link, label: 'Continuity', path: '/continuity' },
  { icon: DollarSign, label: 'Budget', path: '/budget' },
  { icon: Clock, label: 'Timesheet', path: '/timesheet' },
];

const bottomNavItems: NavItem[] = [
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: Download, label: 'Export', path: '/export' },
];

function NavButton({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate: (path: string) => void;
}) {
  const Icon = item.icon;

  return (
    <Tooltip content={item.label} side="right">
      <button
        onClick={() => onNavigate(item.path)}
        className={`relative flex items-center justify-center w-full h-10 transition-colors duration-150
          ${
            isActive
              ? 'text-gold bg-gold-muted'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
          }`}
      >
        {isActive && (
          <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-gold rounded-r" />
        )}
        <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
      </button>
    </Tooltip>
  );
}

export function Sidebar({ currentPath, onNavigate, projectId }: SidebarProps) {
  const resolvePath = (path: string) => {
    if (projectId) {
      return `/project/${projectId}${path}`;
    }
    return path;
  };

  const isActive = (path: string) => {
    return currentPath.includes(path);
  };

  return (
    <aside className="flex flex-col w-16 h-full bg-base border-r border-border-subtle shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-12 border-b border-border-subtle">
        <span className="text-xs font-bold text-gold tracking-wider select-none">
          PH
        </span>
      </div>

      {/* Main navigation */}
      <nav className="flex flex-col gap-1 py-2 flex-1">
        {mainNavItems.map((item) => (
          <NavButton
            key={item.path}
            item={item}
            isActive={isActive(item.path)}
            onNavigate={(path) => onNavigate(resolvePath(path))}
          />
        ))}
      </nav>

      {/* Bottom navigation */}
      <nav className="flex flex-col gap-1 py-2 border-t border-border-subtle">
        {bottomNavItems.map((item) => (
          <NavButton
            key={item.path}
            item={item}
            isActive={isActive(item.path)}
            onNavigate={(path) => onNavigate(resolvePath(path))}
          />
        ))}
      </nav>
    </aside>
  );
}
