'use client';

import React, { useState } from "react";
import { FileData } from "../app/types";

interface FileCardProps {
  file: FileData;
  isProcessed?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export default function FileCard({ file, isProcessed = false, isSelected = false, onToggleSelect }: FileCardProps) {
  const apiBase = (typeof window !== 'undefined' && (window as any).env?.API_BASE) || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
  const [showModal, setShowModal] = useState(false);
  
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
        <div key={k} className="text-xs text-muted-foreground truncate">
          <span className="font-semibold text-foreground">{k}:</span> {formatValue(flatExif[k])}
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
            <div key={`png-${k}`} className="text-xs text-primary truncate">
              <span className="font-semibold">PNG {k}:</span> {formatValue(v)}
            </div>
          );
        }
      });
      const xmpText = xmpInfo && Object.keys(xmpInfo).length > 0 ? formatValue(xmpInfo) : null;
      if (xmpText) {
        metaItems.push(
          <div key="xmp" className="text-xs text-primary truncate">
            <span className="font-semibold">XMP:</span> {xmpText}
          </div>
        );
      }
      if (metaItems.length === 0) return null;
      return (
        <div className="mt-1 pt-1 border-t border-border space-y-0.5">
          <div className="text-xs font-semibold text-foreground">AIGC 元数据</div>
          {metaItems}
        </div>
      );
    })();

    if (items.length === 0 && !metaSection) return <div className="text-xs text-muted-foreground">EXIF/元数据存在但不包含常用标签</div>;
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
        bg-card border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full relative group
        ${isSelected ? 'border-primary ring-2 ring-ring ring-opacity-50' : 'border-border'}
      `}
      onClick={() => setShowModal(true)}
    >
      <div className="h-32 bg-muted relative">
        {typeof file.aigc === 'boolean' && (
          <div className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded ${
            file.aigc ? 'bg-destructive text-destructive-foreground' : 'bg-emerald-500 text-white'
          }`}>
            {file.aigc ? (file.aigc_detail?.source ? `AIGC-${file.aigc_detail.source}` : 'AIGC') : '非AIGC'}
          </div>
        )}
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
          className="absolute top-8 right-2 text-[10px] px-2 py-0.5 rounded bg-black/70 text-white hover:bg-black/80"
        >
          详情
        </button>
        {/* Selection Checkbox Overlay */}
        {onToggleSelect && (
          <div className="absolute top-2 left-2 z-10">
            <div className={`
              w-5 h-5 rounded border shadow-sm flex items-center justify-center transition-colors
              ${isSelected ? 'bg-primary border-primary' : 'bg-white/80 border-gray-400 hover:border-primary'}
            `} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
              {isSelected && (
                <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className="font-medium text-sm text-foreground mb-2 truncate" title={file.filename}>
          {file.filename}
        </div>
        <div className="bg-muted/50 rounded p-2 flex-1 overflow-y-auto max-h-[100px] custom-scrollbar">
          {formatExif(file.exif)}
        </div>
      </div>
      {isProcessed && (
        <div className="p-2 border-t border-border bg-muted/50 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <a 
            href={`${apiBase}/download/${file.id}`} 
            download
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded transition-colors"
          >
            下载
          </a>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="relative bg-card rounded-xl shadow-xl w-[95vw] max-w-[1200px] h-[90vh] overflow-hidden border border-border flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="text-sm font-semibold text-foreground">
                {file.filename} {file.format ? `· ${file.format}` : ''} {file.width && file.height ? `· ${file.width}×${file.height}` : ''}
              </div>
              <button className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80" onClick={() => setShowModal(false)}>关闭</button>
            </div>
            <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 min-h-0">
              <div className="bg-muted/30 rounded-lg border border-border flex items-center justify-center h-full w-full overflow-hidden relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={`${apiBase}/view/${isProcessed ? 'output' : 'upload'}/${file.id}`}
                  alt={file.filename}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex flex-col h-full min-h-0 gap-4">
                <div className="space-y-2 shrink-0">
                  <div className="text-xs font-semibold text-foreground border-b border-border pb-2">基本信息</div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground break-all"><span className="font-medium text-foreground">文件名:</span> {file.filename}</div>
                    {file.format && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">格式:</span> {file.format}</div>}
                    {file.width && file.height && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">分辨率:</span> {file.width} × {file.height}</div>}
                    {typeof file.aigc === 'boolean' && (
                      <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">AIGC:</span> {file.aigc ? `是${file.aigc_detail?.source ? `（${file.aigc_detail.source}）` : ''}` : '否'}</div>
                    )}
                  </div>
                  {isProcessed && (
                    <div className="pt-2">
                      <a 
                        href={`${apiBase}/download/${file.id}`} 
                        download
                        className="w-full block text-center text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded transition-colors"
                      >
                        下载此图片
                      </a>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="text-xs font-semibold text-foreground border-b border-border pb-2 mb-2">全部元数据</div>
                  <div className="overflow-y-auto custom-scrollbar space-y-1 flex-1">
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
                      const metadataList = entries.length > 0 ? entries.sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => (
                        <div key={k} className="text-[11px] text-muted-foreground break-words">
                          <span className="font-semibold text-foreground">{k}:</span> {formatValue(v)}
                        </div>
                      )) : <div className="text-xs text-muted-foreground">无元数据信息</div>;

                      const pngInfo = (file.exif && (file.exif as Record<string, unknown>)['PNG Info']) as Record<string, unknown> | undefined;
                      const xmpInfo = (file.exif && (file.exif as Record<string, unknown>)['XMP']) as Record<string, unknown> | undefined;
                      const aigcItems: React.ReactNode[] = [];
                      const pickKeys = ['parameters', 'prompt', 'workflow', 'sd-metadata', 'Comment', 'Description', 'Software'];
                      if (pngInfo && typeof pngInfo === 'object') {
                        pickKeys.forEach(k => {
                          const v = (pngInfo as Record<string, unknown>)[k];
                          if (v !== undefined) {
                            aigcItems.push(
                              <div key={`m-png-${k}`} className="text-[11px] text-primary break-words">
                                <span className="font-semibold">PNG {k}:</span> {formatValue(v)}
                              </div>
                            );
                          }
                        });
                      }
                      if (xmpInfo && typeof xmpInfo === 'object' && Object.keys(xmpInfo).length > 0) {
                        aigcItems.push(
                          <div key="m-xmp" className="text-[11px] text-primary break-words">
                            <span className="font-semibold">XMP:</span> {formatValue(xmpInfo)}
                          </div>
                        );
                      }
                      
                      return (
                        <>
                          {metadataList}
                          {aigcItems.length > 0 && (
                            <div className="pt-2 border-t border-border mt-2 space-y-1">
                              <div className="text-xs font-semibold text-foreground">AIGC 元数据</div>
                              {aigcItems}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
