import { useMemo } from 'react';
import { Mic } from 'lucide-react';

const TranscriptionOverlay = ({ text, isListening, isDarkMode }) => {
  const waveBars = useMemo(() => Array.from({ length: 8 }, (_, index) => index + 1), []);

  if (!isListening && !text) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
      <div className={`w-full max-w-3xl rounded-[32px] border p-8 shadow-2xl ${isDarkMode ? 'border-navy-700 bg-navy-900/95 text-white' : 'border-slate-200 bg-white/95 text-slate-900'}`}>
        <div className="flex flex-col items-center gap-6">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full ${isListening ? 'bg-red-500/15' : 'bg-slate-200'}`}>
            <Mic size={36} className="text-red-500" />
          </div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">
            {isListening ? 'Listening...' : 'Thinking...'}
          </p>
          <div className={`w-full rounded-3xl p-6 ${isDarkMode ? 'bg-navy-800/90' : 'bg-slate-100'}`}>
            <p className={`text-center text-lg font-semibold leading-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {text || "I'm listening..."}
            </p>
          </div>
          {isListening && (
            <div className="flex items-end justify-center gap-2">
              {waveBars.map((index) => (
                <span key={index} className={`block h-10 w-2 rounded-full animate-pulse ${index % 2 === 0 ? 'bg-red-500' : 'bg-red-300'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptionOverlay;
