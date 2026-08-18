import Link from "next/link";

export default function WorkspacePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-neutral-300 bg-white font-mono text-xs">
        <Link href="/" className="hover:underline text-neutral-500">&lt; BACK TO DASHBOARD</Link>
        <div className="text-blue-600 font-semibold animate-pulse">
          [ AI TUTOR IS WRITING... ]
        </div>
        <div className="text-neutral-500">
          SESSION: 8F2A-99B
        </div>
      </div>

      {/* Main Canvas Area */}
      <main className="flex-1 p-8 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none"></div>
        
        {/* Whiteboard Content container */}
        <div className="w-full h-full relative border border-neutral-300 bg-white/80 shadow-sm flex items-center justify-center">
          
          {/* Stub Card */}
          <div className="neo-box w-96 flex flex-col space-y-4">
            <div className="text-xs font-mono text-neutral-500 uppercase border-b border-neutral-200 pb-2">
              Topic: Quadratic Equations
            </div>
            <div className="text-sm">
              <p className="mb-2 text-neutral-800 font-medium">System:</p>
              <p className="text-neutral-600">Why do you think that happens in this context?</p>
            </div>
            <div className="pt-2">
              <button className="w-full border border-neutral-300 bg-neutral-50 py-2 text-xs font-mono hover:bg-neutral-100 transition-colors">
                [ AWAITING STUDENT RESPONSE ]
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Bottom Control Panel */}
      <div className="h-20 border-t border-neutral-300 bg-white flex items-center px-8 space-x-6">
        <button className="flex items-center justify-center w-12 h-12 border border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800 transition-colors">
          <span className="font-mono text-xs">[ MIC ]</span>
        </button>
        <div className="flex-1 border border-neutral-300 bg-neutral-50 h-12 flex items-center px-4">
          <span className="font-mono text-xs text-neutral-400">[ SUBTITLES ] Waiting for audio input...</span>
        </div>
      </div>
    </div>
  );
}
