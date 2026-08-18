import Link from "next/link";

export default function TeacherPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-300 bg-white">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-semibold tracking-wide uppercase">TEACHER CABINET // OVERVIEW</h1>
        </div>
        <Link href="/" className="text-xs font-mono hover:underline text-neutral-500">
          [ EXIT TO SYSTEM ]
        </Link>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <h2 className="text-lg font-semibold uppercase tracking-tight">Class Activity Heatmap</h2>
          <div className="neo-box h-64 flex items-center justify-center bg-neutral-50">
            <span className="font-mono text-xs text-neutral-400">[ HEATMAP VISUALIZATION STUB ]</span>
          </div>

          <h2 className="text-lg font-semibold uppercase tracking-tight mt-12">Student Sessions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="neo-box space-y-3">
                <div className="flex justify-between border-b border-neutral-200 pb-2">
                  <span className="font-mono text-xs">ID: STU-{800 + i}</span>
                  <span className="font-mono text-xs text-green-600">ACTIVE</span>
                </div>
                <div className="text-sm text-neutral-700">
                  Current topic: <span className="font-medium">Linear Algebra</span>
                </div>
                <button className="text-xs font-mono border border-neutral-300 w-full py-1 hover:bg-neutral-100 transition-colors">
                  [ INTERVENE ]
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
