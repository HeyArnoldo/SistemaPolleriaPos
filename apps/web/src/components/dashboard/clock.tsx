import { useEffect, useState } from 'react';

export function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-right">
      <p className="text-sm text-slate-700 font-semibold">
        {now.toLocaleDateString('es-ES', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>
      <p className="text-xs text-slate-500">{now.toLocaleTimeString('es-ES')}</p>
    </div>
  );
}
