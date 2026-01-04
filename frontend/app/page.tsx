'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileData } from './types';
import FileCard from '@/components/FileCard';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const [processedFiles, setProcessedFiles] = useState<FileData[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showCustomJson, setShowCustomJson] = useState(false);
  const [customJsonText, setCustomJsonText] = useState('');
  const [convertToJpg, setConvertToJpg] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach(uploadFile);
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setUploadedFiles(prev => [data, ...prev]);
      }
    } catch (err) {
      console.error(err);
      alert('上传失败');
    }
  };

  const processAll = async (action: string, extraData: any = {}) => {
    if (uploadedFiles.length === 0) {
      alert('请先上传照片');
      return;
    }

    const promises = uploadedFiles.map(file => {
      return fetch('/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: file.id,
          action: action,
          convert_to_jpg: convertToJpg,
          ...extraData
        })
      })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          return {
            ...file,
            exif: res.exif,
            filename: res.new_filename || file.filename
          } as FileData;
        }
        return null;
      });
    });

    const results = await Promise.all(promises);
    const successful = results.filter((r): r is FileData => r !== null);
    
    if (successful.length > 0) {
      setProcessedFiles(prev => [...successful, ...prev]);
      alert(`处理完成: ${successful.length}/${uploadedFiles.length} 成功`);
      // Clear selection on new process results? Or keep?
      // Usually clear to avoid confusion.
      setSelectedIds(new Set());
    } else {
      alert('处理失败或无文件成功处理');
    }
  };

  const handleCustomApply = () => {
    try {
      const jsonData = JSON.parse(customJsonText);
      processAll('import_custom', { custom_data: jsonData });
      setShowCustomJson(false);
    } catch (e: any) {
      alert('JSON 格式错误: ' + e.message);
    }
  };

  const downloadBatch = async () => {
    if (processedFiles.length === 0) {
      alert('没有可下载的处理结果');
      return;
    }

    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : processedFiles.map(f => f.id);
    
    try {
      const res = await fetch('/download_batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "processed_photos.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert('下载失败');
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === processedFiles.length && processedFiles.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedFiles.map(f => f.id)));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex flex-col font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <header className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 px-8 py-4 sticky top-0 z-10 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-500">蓝梅EXIF信息格式化工具</h1>
      </header>

      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1 p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6"
      >
        {/* Controls Section */}
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
          <div className="flex flex-wrap gap-3 justify-center items-center">
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 cursor-pointer select-none transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700">
              <input 
                type="checkbox" 
                checked={convertToJpg}
                onChange={(e) => setConvertToJpg(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">转为JPG格式</span>
            </label>
            <div className="h-6 w-px bg-gray-300 dark:bg-neutral-700 mx-1"></div>
            <button 
              onClick={() => processAll('clear')}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium shadow-sm active:transform active:scale-95"
            >
              清除所有EXIF
            </button>
            <button 
              onClick={() => processAll('import_preset', { preset: 'sony_a7m4' })}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium shadow-sm active:transform active:scale-95"
            >
              导入 Sony A7M4 预设
            </button>
            <button 
              onClick={() => processAll('import_preset', { preset: 'fuji_xt5' })}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium shadow-sm active:transform active:scale-95"
            >
              导入 Fuji X-T5 预设
            </button>
            <button 
              onClick={() => processAll('import_preset', { preset: 'hasselblad_x2d' })}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium shadow-sm active:transform active:scale-95"
            >
              导入 Hasselblad X2D 预设
            </button>
            <button 
              onClick={() => setShowCustomJson(!showCustomJson)}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium shadow-sm active:transform active:scale-95"
            >
              导入自定义 JSON
            </button>
          </div>

          {showCustomJson && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800"
            >
              <textarea
                value={customJsonText}
                onChange={(e) => setCustomJsonText(e.target.value)}
                rows={5}
                className="w-full p-3 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow font-mono text-sm bg-white dark:bg-neutral-900 dark:text-gray-200"
                placeholder="在此粘贴 JSON 配置..."
              />
              <button 
                onClick={handleCustomApply}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                应用自定义配置
              </button>
            </motion.div>
          )}
        </div>

        {/* Workspace */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-[600px]">
          {/* Upload Column */}
          <div className="flex-1 bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-100 dark:border-neutral-800">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">待处理图片</h2>
              <button 
                onClick={() => setUploadedFiles([])}
                className="text-sm px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-md transition-colors border border-gray-200 dark:border-neutral-700"
              >
                清空列表
              </button>
            </div>

            <div 
              id="drop-zone"
              className={`
                mb-6 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]' : 'border-gray-300 dark:border-neutral-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}
              `}
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-4xl mb-3">📁</div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">点击或拖拽照片到此处上传</p>
              <input 
                type="file" 
                id="file-input" 
                multiple 
                accept="image/jpeg,image/png,image/tiff,image/webp" 
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto max-h-[800px] pr-1">
              <AnimatePresence>
                {uploadedFiles.map(file => (
                  <motion.div 
                    key={file.id} 
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="h-[280px]"
                  >
                    <FileCard file={file} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {uploadedFiles.length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-400 dark:text-gray-600 text-sm">
                  暂无上传图片
                </div>
              )}
            </div>
          </div>

          {/* Result Column */}
          <div className="flex-1 bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 p-6 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-100 dark:border-neutral-800">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">处理结果</h2>
              <div className="flex gap-2">
                <button 
                  onClick={downloadBatch}
                  className="text-sm px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors shadow-sm"
                >
                  批量下载 ZIP
                </button>
                <button 
                  onClick={() => setProcessedFiles([])}
                  className="text-sm px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-md transition-colors border border-gray-200 dark:border-neutral-700"
                >
                  清空结果
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto max-h-[800px] pr-1">
              <AnimatePresence>
                {processedFiles.map((file, idx) => (
                  <motion.div 
                    key={`${file.id}-${idx}`} 
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="h-[280px]"
                  >
                    <FileCard 
                      file={file} 
                      isProcessed={true} 
                      isSelected={selectedIds.has(file.id)}
                      onToggleSelect={() => handleToggleSelect(file.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              {processedFiles.length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-400 dark:text-gray-600 text-sm">
                  暂无处理结果
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.main>

      <footer className="bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
        copyright lanmei studio. | build by CrazyMa
      </footer>
    </div>
  );
}
