import { useState } from 'react';
import { Sun } from 'lucide-react';

interface ResilientProductImageProps {
  src: string;
  alt: string;
  categoryLabel: string;
  className?: string;
}

export function ResilientProductImage({
  src,
  alt,
  categoryLabel,
  className = '',
}: ResilientProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-slate-100 text-slate-600 p-6 text-center ${className}`}
      >
        <Sun className="w-10 h-10 text-sky-600 mb-2" strokeWidth={1.6} />
        <p className="text-xs font-medium text-slate-500">{categoryLabel}</p>
        <p className="text-sm font-semibold text-slate-800 mt-1 line-clamp-2">{alt}</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-slate-50 flex items-center justify-center ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-contain p-4 transition-transform duration-200 ease-out group-hover:scale-[1.03]"
      />
    </div>
  );
}
