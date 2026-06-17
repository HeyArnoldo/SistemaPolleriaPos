import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    </div>
  );
}
