# 蓝梅 EXIF 工具 (Lanmei EXIF Tool)

这是一个基于 **Python Flask** (后端) 和 **Next.js** (前端) 构建的现代化 EXIF 信息处理工具。
旨在为摄影师、设计师和隐私关注者提供简单、高效的 EXIF 查看、清除、修改以及 AIGC 去痕功能。

## ✨ 功能特点

*   **🛡️ 隐私保护 (EXIF 清除)**：一键移除照片中的所有 EXIF 元数据（如拍摄位置、相机参数等），保护您的隐私。
*   **🧹 AIGC 深度去痕 (Deep Clean)**：专为 AIGC 生成图片设计，通过微旋转、重采样、像素位移、色彩微调及噪点注入等组合策略，有效对抗平台检测。
*   **🖼️ 格式转换**：支持在处理时将 HEIC/PNG/WebP 等格式自动转换为兼容性更好的 JPG 格式。
*   ** EXIF 修改/注入**：
    *   支持导入 JSON 格式的自定义 EXIF 数据。
    *   内置常用相机（如 Sony A7M4, Fujifilm X-T5, Hasselblad X2D）的预设模板。
*   **👀 实时预览**：
    *   上传即刻查看照片详细信息，支持大图查看。
    *   处理前后对比，直观感受画质与元数据变化。
*   **📉 胶片颗粒模拟**：内置自适应胶片颗粒（Noise/Grain）添加功能，支持强度调节，增加照片质感。
*   **🤖 AIGC 智能检测**：自动解析 PNG Info (Parameters, Prompt, Workflow)、XMP、EXIF 中的 AIGC 线索，识别并标注生成来源。
*   **💾 批量处理与下载**：支持多文件上传、批量处理，并提供一键打包 (ZIP) 下载功能。

## 🛠️ 技术栈

**前端 (Frontend)**
*   **Framework**: Next.js (App Router)
*   **Library**: React, Radix UI
*   **Styling**: Tailwind CSS 4
*   **Icons**: Radix UI Icons

**后端 (Backend)**
*   **Framework**: Flask
*   **Image Processing**: Pillow (PIL)
*   **EXIF Handling**: piexif

## 🚀 快速开始

### 1. 环境准备

*   **Python**: 3.9+
*   **Node.js**: 18.0+

### 2. 安装依赖

**后端依赖**
```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

**前端依赖**
```bash
cd frontend
npm install
```

### 3. 运行项目

**启动后端服务**
```bash
python app.py
# 服务默认运行在 http://127.0.0.1:5000
```

**启动前端开发服务器**
```bash
cd frontend
npm run dev
# 前端默认运行在 http://localhost:3000
```

## 📂 目录架构

```
Lanmei-EXIF-Tools/
├── app.py              # Flask 后端主入口 (API & 静态资源服务)
├── utils.py            # 核心图像处理逻辑 (EXIF, Deep Clean, Grain)
├── requirements.txt    # Python 依赖列表
├── presets/            # EXIF 预设文件 (.json)
│   ├── sony_a7m4.json
│   ├── fuji_xt5.json
│   └── ...
├── frontend/           # Next.js 前端项目
│   ├── app/            # App Router 页面与布局
│   ├── components/     # React 组件 (FileCard, UI等)
│   └── ...
├── uploads/            # [自动生成] 图片上传临时目录
└── outputs/            # [自动生成] 处理结果输出目录
```

## 📚 API 文档

### 自定义 EXIF JSON 格式示例

在进行“自定义修改”时，请参考以下 JSON 结构：

```json
{
    "0th": {
        "Make": "SONY",
        "Model": "ILCE-7M4",
        "Software": "ILCE-7M4 v1.00",
        "Artist": "Lanmei User"
    },
    "Exif": {
        "DateTimeOriginal": "2024:05:20 13:14:00",
        "ISOSpeedRatings": 200,
        "FNumber": [28, 10],            
        "ExposureTime": [1, 500],       
        "FocalLength": [500, 10],       
        "LensModel": "FE 24-70mm F2.8 GM"
    },
    "GPS": {
        "GPSLatitudeRef": "N",
        "GPSLatitude": [[35, 1], [40, 1], [15, 1]],
        "GPSLongitudeRef": "E",
        "GPSLongitude": [[139, 1], [45, 1], [10, 1]]
    }
}
```

> **参数说明**:
> *   `FNumber`: `[28, 10]` 表示光圈 f/2.8 (28/10)
> *   `ExposureTime`: `[1, 500]` 表示快门 1/500 秒
> *   `FocalLength`: `[500, 10]` 表示焦距 50mm

## 📖 使用指南

1.  **上传图片**：直接拖拽或点击上传区域选择图片（支持 JPG/PNG/WebP/TIFF）。
2.  **选择操作**：
    *   **深度去痕 (AIGC)**：勾选此项可启用对抗性处理算法，去除 AIGC 特征。
    *   **选择预设**：下拉选择相机型号预设，或选择“无预设 (仅清除/去痕)”。
3.  **开始处理**：点击“开始处理”按钮，系统将自动执行清除、修改或去痕操作。
4.  **预览与下载**：
    *   点击处理结果卡片的“详情”按钮，可在模态窗中查看大图和详细元数据。
    *   点击“下载”按钮保存单张图片，或使用底部栏的“批量下载”功能。

## ⚠️ 注意事项

*   **Deep Clean (深度去痕)** 会对图片像素进行微小的破坏性修改（如微旋转、噪点），这是为了对抗检测算法所必需的，可能会轻微影响画质。
*   本地运行模式下，所有文件仅存储在您的计算机上，不会上传至任何云端服务器。

---
License: MIT
