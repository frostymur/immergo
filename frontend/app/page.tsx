import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-300 bg-white">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-semibold tracking-wide uppercase">AI_STUDY_WORKSPACE // NEO-GOV</h1>
        </div>
        <div className="flex items-center space-x-6 text-xs font-mono">
          <span className="px-2 py-1 bg-neutral-100 border border-neutral-300">
            [ SYSTEM: ONLINE ]
          </span>
          <div className="flex space-x-2">
            <span className="cursor-pointer hover:underline">[ KZ</span>
            <span className="text-neutral-400">|</span>
            <span className="font-bold underline cursor-pointer">RU</span>
            <span className="text-neutral-400">|</span>
            <span className="cursor-pointer hover:underline">EN ]</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 bg-[#F8F9FA]">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Student Mode Card */}
          <Link href="/workspace" className="group block">
            <div className="h-64 neo-box flex flex-col justify-between transition-colors hover:bg-neutral-50">
              <div className="text-xs font-mono text-neutral-500">01 //</div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight uppercase group-hover:underline">РЕЖИМ УЧЕНИКА</h2>
                <p className="mt-2 text-sm text-neutral-600">Интерактивная доска Lumi, ИИ-Тьютор и голосовое взаимодействие.</p>
              </div>
              <div className="text-xs font-mono text-neutral-400 self-end group-hover:text-neutral-900 transition-colors">
                [ ENTER &gt; ]
              </div>
            </div>
          </Link>

          {/* Teacher Cabinet Card */}
          <Link href="/teacher" className="group block">
            <div className="h-64 neo-box flex flex-col justify-between transition-colors hover:bg-neutral-50">
              <div className="text-xs font-mono text-neutral-500">02 //</div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight uppercase group-hover:underline">КАБИНЕТ УЧИТЕЛЯ</h2>
                <p className="mt-2 text-sm text-neutral-600">Панель управления классом, аналитика и Heatmap успеваемости.</p>
              </div>
              <div className="text-xs font-mono text-neutral-400 self-end group-hover:text-neutral-900 transition-colors">
                [ ENTER &gt; ]
              </div>
            </div>
          </Link>

        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-6 py-3 border-t border-neutral-300 bg-white text-xs font-mono text-neutral-500">
        <div>WCAG 2.1 COMPLIANCE: <span className="text-green-600 font-semibold">VERIFIED</span></div>
        <div>RAG MODULE: <span className="text-green-600 font-semibold">ACTIVE</span></div>
      </footer>
    </div>
  );
}
