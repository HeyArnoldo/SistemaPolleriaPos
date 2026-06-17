import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { SyncStatus } from '@/components/ui/sync-status';
import { Clock } from '@/components/dashboard/clock';

interface AppNavbarProps {
  isOnline: boolean;
  isOfflineMode: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
}

export function AppNavbar({
  isOnline,
  isOfflineMode,
  pendingCount,
  isSyncing,
  onSyncNow,
}: AppNavbarProps) {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter((s) => s !== '');
  const breadcrumbs = segments.map((segment, index) => {
    const fullPath = `/${segments.slice(0, index + 1).join('/')}`;
    return {
      name: segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      path: fullPath,
    };
  });

  return (
    <nav className="flex h-16 shrink-0 items-center gap-2 border-b justify-between bg-white">
      <div className="flex items-center gap-2 px-3">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList className="flex items-center">
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={crumb.path}>
                <BreadcrumbItem>
                  {index < breadcrumbs.length - 1 ? (
                    <Link to={crumb.path} className="hidden md:block opacity-90 hover:opacity-100">
                      {crumb.name}
                    </Link>
                  ) : (
                    <BreadcrumbPage className="font-semibold">{crumb.name}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2 px-3">
        {isOfflineMode && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <WifiOff className="h-3 w-3" />
            Sin conexión
          </span>
        )}
        <SyncStatus
          isOnline={isOnline}
          pendingCount={pendingCount}
          isSyncing={isSyncing}
          onSyncNow={onSyncNow}
        />
        <Clock />
      </div>
    </nav>
  );
}
