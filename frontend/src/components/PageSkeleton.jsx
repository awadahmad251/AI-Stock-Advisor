export default function PageSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-dark-300/60" />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-dark-300/60" />
          <div className="h-3 w-60 rounded bg-dark-300/40" />
        </div>
      </div>

      {/* Card skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-dark-200/60 border border-dark-300/30" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl bg-dark-200/60 border border-dark-300/30 overflow-hidden">
        <div className="h-10 bg-dark-300/40" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 border-t border-dark-300/20 flex items-center px-4 gap-4">
            <div className="h-4 w-16 rounded bg-dark-300/40" />
            <div className="h-4 w-32 rounded bg-dark-300/30" />
            <div className="h-4 w-20 rounded bg-dark-300/30 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
