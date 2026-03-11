import { Shield } from 'lucide-react';

export default function SandboxBanner() {
  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <Shield className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-amber-900 text-base tracking-widest uppercase">
            📧 Email Engine Sandbox
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              'TEST / CONTROLLED MODE',
              'ISOLATED FROM PRODUCTION',
              'NO AUTOMATIC LEAD CREATION',
              'NO AUTOMATIC REPLIES',
              'MANUAL SEND ONLY',
              'PHASE 1',
            ].map(tag => (
              <span
                key={tag}
                className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-semibold border border-amber-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}