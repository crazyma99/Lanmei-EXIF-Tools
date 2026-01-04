import { FileData } from "../app/types";

interface FileCardProps {
  file: FileData;
  isProcessed?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export default function FileCard({ file, isProcessed = false, isSelected = false, onToggleSelect }: FileCardProps) {
  const formatExif = (exifData: Record<string, any>) => {
    if (!exifData || Object.keys(exifData).length === 0) return "无 EXIF 信息";

    const displayKeys = [
      'Make', 'Model', 'LensModel', 'FNumber', 
      'ExposureTime', 'ISOSpeedRatings', 'DateTimeOriginal', 'FocalLength'
    ];

    const flatExif: Record<string, any> = {};
    for (const ifd in exifData) {
      if (typeof exifData[ifd] === 'object') {
        for (const key in exifData[ifd]) {
          flatExif[key] = exifData[ifd][key];
        }
      }
    }

    const items = displayKeys
      .filter(k => flatExif[k])
      .map(k => (
        <div key={k} className="text-xs text-gray-600 dark:text-gray-400 truncate">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{k}:</span> {flatExif[k]}
        </div>
      ));

    if (items.length === 0) return <div className="text-xs text-gray-500 dark:text-gray-500">EXIF 数据存在但不包含常用标签</div>;
    return <div className="space-y-0.5">{items}</div>;
  };

  return (
    <div 
      className={`
        bg-white dark:bg-neutral-800 border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full relative group
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' : 'border-gray-200 dark:border-neutral-700'}
      `}
      onClick={onToggleSelect ? () => onToggleSelect() : undefined}
    >
      <div className="h-32 bg-gray-100 dark:bg-neutral-900 relative">
        {/* Selection Checkbox Overlay */}
        {onToggleSelect && (
          <div className="absolute top-2 left-2 z-10">
            <div className={`
              w-5 h-5 rounded border shadow-sm flex items-center justify-center transition-colors
              ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white/80 dark:bg-black/50 border-gray-400 hover:border-blue-400'}
            `}>
              {isSelected && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={file.thumbnail_url} 
          alt={file.filename}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="font-medium text-sm text-gray-800 dark:text-gray-200 mb-2 truncate" title={file.filename}>
          {file.filename}
        </div>
        <div className="bg-gray-50 dark:bg-neutral-900 rounded p-2 flex-1 overflow-y-auto max-h-[100px] custom-scrollbar">
          {formatExif(file.exif)}
        </div>
      </div>
      {isProcessed && (
        <div className="p-2 border-t border-gray-100 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <a 
            href={`/download/${file.id}`} 
            download
            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded transition-colors"
          >
            下载
          </a>
        </div>
      )}
    </div>
  );
}
