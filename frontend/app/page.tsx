'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileData } from './types';
import FileCard from '@/components/FileCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  UploadIcon, 
  TrashIcon, 
  DownloadIcon, 
  MagicWandIcon, 
  EraserIcon, 
  ImageIcon, 
  FileTextIcon,
  MixerHorizontalIcon
} from '@radix-ui/react-icons';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const [processedFiles, setProcessedFiles] = useState<FileData[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [convertToJpg, setConvertToJpg] = useState(false);
  const [clearAIGC, setClearAIGC] = useState(false);
  const [addNoise, setAddNoise] = useState(false);
  const [noiseIntensity, setNoiseIntensity] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPreset, setSelectedPreset] = useState<string>('sony_a7m4');
  const apiBase = (typeof window !== 'undefined' && (window as any).env?.API_BASE) || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

  const defaultJsonExample = `{
  "0th": {
    "Make": "Camera Maker",
    "Model": "Camera Model"
  },
  "Exif": {
    "FNumber": [28, 10],
    "ISOSpeedRatings": 100
  }
}`;

  const [customJsonText, setCustomJsonText] = useState(defaultJsonExample);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setUploadedFiles(prev => [data as FileData, ...prev]);
      }
    } catch (err) {
      console.error(err);
      alert('上传失败');
    }
  };
 
  const handleFiles = (files: FileList) => {
    Array.from(files).forEach(uploadFile);
  };
 
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const processAll = async (action: string, extraData: Record<string, unknown> = {}) => {
    if (uploadedFiles.length === 0) {
      alert('请先上传照片');
      return;
    }

    const promises = uploadedFiles.map(file => {
      return fetch(`${apiBase}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: file.id,
          action: action,
          convert_to_jpg: convertToJpg,
          clear_aigc: clearAIGC,
          add_noise: addNoise,
          noise_intensity: noiseIntensity,
          ...extraData
        })
      })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          return {
            ...file,
            exif: res.exif,
            filename: res.new_filename || file.filename,
            aigc: res.aigc ?? file.aigc,
            aigc_detail: res.aigc_detail ?? file.aigc_detail,
            width: res.width ?? file.width,
            height: res.height ?? file.height,
            format: res.format ?? file.format
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

  const handleApplyPreset = () => {
    if (selectedPreset === 'custom') {
      try {
        const jsonData = JSON.parse(customJsonText);
        processAll('import_custom', { custom_data: jsonData });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert('JSON 格式错误: ' + msg);
      }
    } else {
      processAll('import_preset', { preset: selectedPreset });
    }
  };

  const downloadBatch = async () => {
    if (processedFiles.length === 0) {
      alert('没有可下载的处理结果');
      return;
    }

    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : processedFiles.map(f => f.id);
    
    try {
      const res = await fetch(`${apiBase}/download_batch`, {
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

  

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-foreground transition-colors duration-300">
      <header className="bg-card border-b border-border px-8 py-4 sticky top-0 z-10 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <ImageIcon className="w-6 h-6" />
          蓝梅EXIF信息格式化工具
        </h1>
      </header>

      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1 p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6"
      >
        {/* Controls Section */}
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-4 text-lg font-semibold text-foreground border-b border-border pb-2">
            <MixerHorizontalIcon className="w-5 h-5" />
            处理配置
          </div>
          <div className="flex flex-wrap gap-3 justify-center items-center">
            <div className="flex items-center space-x-2 px-3 py-2 bg-secondary/50 rounded-lg border border-border">
              <Checkbox 
                id="convert-jpg" 
                checked={convertToJpg}
                onCheckedChange={(checked) => setConvertToJpg(checked as boolean)}
              />
              <Label htmlFor="convert-jpg">转为JPG格式</Label>
            </div>
            
            <div className="flex items-center space-x-2 px-3 py-2 bg-secondary/50 rounded-lg border border-border">
              <Checkbox 
                id="clear-aigc" 
                checked={clearAIGC}
                onCheckedChange={(checked) => setClearAIGC(checked as boolean)}
              />
              <Label htmlFor="clear-aigc">清除AIGC标识</Label>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg border border-border">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="add-noise" 
                  checked={addNoise}
                  onCheckedChange={(checked) => setAddNoise(checked as boolean)}
                />
                <Label htmlFor="add-noise">增加颗粒</Label>
              </div>
              
              {addNoise && (
                <div className="flex items-center gap-3 ml-2 border-l border-border pl-3 w-[180px]">
                  <Label htmlFor="noise-intensity" className="text-xs text-muted-foreground whitespace-nowrap">
                    强度: {noiseIntensity}
                  </Label>
                  <Slider
                    id="noise-intensity"
                    defaultValue={[10]}
                    max={100}
                    step={1}
                    value={[noiseIntensity]}
                    onValueChange={(value) => setNoiseIntensity(value[0])}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-border mx-1"></div>
            
            <Button 
              variant="destructive"
              onClick={() => processAll('clear')}
            >
              <EraserIcon className="mr-2 h-4 w-4" />
              清除所有EXIF
            </Button>
            
            <div className="flex items-center gap-2">
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="选择预设" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sony_a7m4">Sony A7M4 预设</SelectItem>
                  <SelectItem value="fuji_xt5">Fuji X-T5 预设</SelectItem>
                  <SelectItem value="hasselblad_x2d">Hasselblad X2D 预设</SelectItem>
                  <SelectItem value="custom">自定义 JSON</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="default"
                onClick={handleApplyPreset}
              >
                <MagicWandIcon className="mr-2 h-4 w-4" />
                应用预设
              </Button>
            </div>
          </div>

          {selectedPreset === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 border border-border rounded-lg bg-secondary/30"
            >
              <Textarea
                value={customJsonText}
                onChange={(e) => setCustomJsonText(e.target.value)}
                rows={10}
                className="font-mono text-sm bg-background"
                placeholder="在此粘贴 JSON 配置..."
              />
            </motion.div>
          )}
        </div>

        {/* Workspace */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-[600px]">
          {/* Upload Column */}
          <div className="flex-1 bg-card rounded-xl shadow-sm border border-border p-6 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                待处理图片
              </h2>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setUploadedFiles([])}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                清空列表
              </Button>
            </div>

            <div 
              id="drop-zone"
              className={`
                mb-6 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                ${isDragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-secondary/50'}
              `}
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex justify-center mb-3">
                <UploadIcon className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">点击或拖拽照片到此处上传</p>
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
                <div className="col-span-full text-center py-10 text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <ImageIcon className="w-8 h-8 opacity-20" />
                  暂无上传图片
                </div>
              )}
            </div>
          </div>

          {/* Result Column */}
          <div className="flex-1 bg-card rounded-xl shadow-sm border border-border p-6 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FileTextIcon className="w-5 h-5" />
                处理结果
              </h2>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="default"
                  onClick={downloadBatch}
                >
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  批量下载 ZIP
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setProcessedFiles([])}
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  清空结果
                </Button>
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
                <div className="col-span-full text-center py-10 text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <FileTextIcon className="w-8 h-8 opacity-20" />
                  暂无处理结果
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.main>

      <footer className="bg-card border-t border-border py-6 text-center text-muted-foreground text-sm">
        copyright lanmei studio. | build by CrazyMa
      </footer>
    </div>
  );
}
