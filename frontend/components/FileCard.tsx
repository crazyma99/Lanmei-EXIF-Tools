import type React from "react";
import { FileData } from "../app/types";

interface FileCardProps {
  file: FileData;
  isProcessed?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export default function FileCard({ file, isProcessed = false, isSelected = false, onToggleSelect }: FileCardProps) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
  const [showModal, setShowModal] = (typeof window !== 'undefined') ? (require('react').useState as typeof import('react').useState<boolean>)(false) : [false, () => {}];
  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => formatValue(v)).join(', ');
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  };
  const formatExif = (exifData: Record<string, unknown>) => {
    if (!exifData || Object.keys(exifData).length === 0) return "无 EXIF 信息";

    const displayKeys = [
      'Make', 'Model', 'LensModel', 'FNumber', 
      'ExposureTime', 'ISOSpeedRatings', 'DateTimeOriginal', 'FocalLength', 'UserComment'
    ];

    const flatExif: Record<string, unknown> = {};
    for (const ifd in exifData) {
      const v = exifData[ifd];
      if (v && typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        for (const key in obj) {
          flatExif[key] = obj[key];
        }
      }
    }

    const items = displayKeys
      .filter(k => flatExif[k] !== undefined)
      .map(k => (
        <div key={k} className="text-xs text-gray-600 dark:text-gray-400 truncate">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{k}:</span> {formatValue(flatExif[k])}
        </div>
      ));

    const metaSection = (() => {
      const pngInfo = (exifData['PNG Info'] ?? {}) as Record<string, unknown>;
      const xmpInfo = (exifData['XMP'] ?? {}) as Record<string, unknown>;
      const metaItems: React.ReactNode[] = [];
      const pickKeys = ['parameters', 'prompt', 'workflow', 'sd-metadata', 'Comment', 'Description', 'Software'];
      pickKeys.forEach(k => {
        const v = (pngInfo && typeof pngInfo === 'object') ? (pngInfo as Record<string, unknown>)[k] : undefined;
        if (v !== undefined) {
          metaItems.push(
            <div key={`png-${k}`} className="text-xs text-purple-700 dark:text-purple-300 truncate">
              <span className="font-semibold">PNG {k}:</span> {formatValue(v)}
            </div>
          );
        }
      });
      const xmpText = xmpInfo && Object.keys(xmpInfo).length > 0 ? formatValue(xmpInfo) : null;
      if (xmpText) {
        metaItems.push(
          <div key="xmp" className="text-xs text-indigo-700 dark:text-indigo-300 truncate">
            <span className="font-semibold">XMP:</span> {xmpText}
          </div>
        );
      }
      if (metaItems.length === 0) return null;
      return (
        <div className="mt-1 pt-1 border-t border-gray-100 dark:border-neutral-700 space-y-0.5">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">AIGC 元数据</div>
          {metaItems}
        </div>
      );
    })();

    if (items.length === 0 && !metaSection) return <div className="text-xs text-gray-500 dark:text-gray-500">EXIF/元数据存在但不包含常用标签</div>;
    return (
      <div className="space-y-0.5">
        {items}
        {metaSection}
      </div>
    );
  };

  return (
    <div 
      className={`
        bg-white dark:bg-neutral-800 border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full relative group
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' : 'border-gray-200 dark:border-neutral-700'}
      `}
      onClick={() => setShowModal(true)}
    >
      <div className="h-32 bg-gray-100 dark:bg-neutral-900 relative">
        {'aigc' in file && typeof (file as any).aigc === 'boolean' && (
          <div className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded ${
            (file as any).aigc ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}>
            {(file as any).aigc ? ((file as any).aigc_detail?.source ? `AIGC-${(file as any).aigc_detail.source}` : 'AIGC') : '非AIGC'}
          </div>
        )}
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
          className="absolute top-8 right-2 text-[10px] px-2 py-0.5 rounded bg-gray-800/70 text-white hover:bg-gray-700"
        >
          详情
        </button>
        {/* Selection Checkbox Overlay */}
        {onToggleSelect && (
          <div className="absolute top-2 left-2 z-10">
            <div className={`
              w-5 h-5 rounded border shadow-sm flex items-center justify-center transition-colors
              ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white/80 dark:bg-black/50 border-gray-400 hover:border-blue-400'}
            `} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
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
          src={`${apiBase}${file.thumbnail_url}`} 
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
            href={`${apiBase}/download/${file.id}`} 
            download
            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded transition-colors"
          >
            下载
          </a>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="relative bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-[90vw] max-w-[900px] max-h-[80vh] overflow-hidden border border-gray-200 dark:border-neutral-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {file.filename} {file.format ? `· ${file.format}` : ''} {file.width && file.height ? `· ${file.width}×${file.height}` : ''}
              </div>
              <button className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700" onClick={() => setShowModal(false)}>关闭</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">基本信息</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">文件名: {file.filename}</div>
                {file.format && <div className="text-xs text-gray-600 dark:text-gray-400">格式: {file.format}</div>}
                {file.width && file.height && <div className="text-xs text-gray-600 dark:text-gray-400">分辨率: {file.width} × {file.height}</div>}
                {'aigc' in file && typeof (file as any).aigc === 'boolean' && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">AIGC: {(file as any).aigc ? `是${(file as any).aigc_detail?.source ? `（${(file as any).aigc_detail.source}）` : ''}` : '否'}</div>
                )}
                {isProcessed && (
                  <a 
                    href={`${apiBase}/download/${file.id}`} 
                    download
                    className="inline-block text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded transition-colors"
                  >
                    下载此图片
                  </a>
                )}
              </div>
              <div className="space-y-2 overflow-y-auto max-h-[55vh]">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">全部元数据</div>
                <div className="space-y-1">
                  {(() => {
                    const flat: Record<string, unknown> = {};
                    if (file.exif && typeof file.exif === 'object') {
                      for (const ifd in file.exif) {
                        const v = (file.exif as Record<string, unknown>)[ifd];
                        if (v && typeof v === 'object') {
                          const obj = v as Record<string, unknown>;
                          for (const key in obj) {
                            if (flat[key] === undefined) flat[key] = obj[key];
                          }
                        }
                      }
                    }
                    const entries = Object.entries(flat);
                    if (entries.length === 0) return <div className="text-xs text-gray-500 dark:text-gray-500">无元数据信息</div>;
                    return entries.sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => (
                      <div key={k} className="text-[11px] text-gray-600 dark:text-gray-400">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{k}:</span> {formatValue(v)}
                      </div>
                    ));
                  })()}
                  {(() => {
                    const pngInfo = (file.exif && (file.exif as Record<string, unknown>)['PNG Info']) as Record<string, unknown> | undefined;
                    const xmpInfo = (file.exif && (file.exif as Record<string, unknown>)['XMP']) as Record<string, unknown> | undefined;
                    const items: React.ReactNode[] = [];
                    const pickKeys = ['parameters', 'prompt', 'workflow', 'sd-metadata', 'Comment', 'Description', 'Software'];
                    if (pngInfo && typeof pngInfo === 'object') {
                      pickKeys.forEach(k => {
                        const v = (pngInfo as Record<string, unknown>)[k];
                        if (v !== undefined) {
                          items.push(
                            <div key={`m-png-${k}`} className="text-[11px] text-purple-700 dark:text-purple-300">
                              <span className="font-semibold">PNG {k}:</span> {formatValue(v)}
                            </div>
                          );
                        }
                      });
                    }
                    if (xmpInfo && typeof xmpInfo === 'object' && Object.keys(xmpInfo).length > 0) {
                      items.push(
                        <div key="m-xmp" className="text-[11px] text-indigo-700 dark:text-indigo-300">
                          <span className="font-semibold">XMP:</span> {formatValue(xmpInfo)}
                        </div>
                      );
                    }
                    if (items.length === 0) return null;
                    return (
                      <div className="pt-2 border-t border-gray-100 dark:border-neutral-700 space-y-1">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">AIGC 元数据</div>
                        {items}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
