# 蓝梅 EXIF 工具 (Lanmei EXIF Tool)

这是一个基于 **Python Flask** (后端) 和 **Next.js** (前端) 构建的现代化 EXIF 信息处理工具。
旨在为摄影师、设计师和隐私关注者提供简单、高效的 EXIF 查看、清除和修改功能。

## ✨ 功能特点

*   **🛡️ 隐私保护 (EXIF 清除)**：一键移除照片中的所有 EXIF 元数据（如拍摄位置、相机参数等），保护您的隐私。
*   **🖼️ 格式转换**：支持在处理时将 HEIC/PNG 等格式自动转换为兼容性更好的 JPG 格式。
*   **📂 批量处理**：支持拖放上传和批量文件选择，一次性处理多张图片。
*   **📝 EXIF 修改/注入**：
    *   支持导入 JSON 格式的自定义 EXIF 数据。
    *   内置常用相机（如 Sony A7M4, Fujifilm X-T5）的预设模板。
*   **👀 实时预览**：上传即刻查看照片详细信息，处理前后对比。
*   **💾 便捷下载**：支持单张下载处理后的图片，或一键打包下载所有文件 (ZIP)。
*   **🎨 现代化界面**：基于 Next.js 16 和 Tailwind CSS 4 构建的响应式流体界面。

## 🛠️ 技术栈

**前端 (Frontend)**
*   **Framework**: Next.js 16.1 (App Router)
*   **Library**: React 19
*   **Styling**: Tailwind CSS 4
*   **Animation**: Framer Motion
*   **Icons**: Lucide React

**后端 (Backend)**
*   **Framework**: Flask 3.1
*   **Image Processing**: Pillow (PIL) 11.0
*   **EXIF Handling**: piexif

## 🚀 快速开始

本项目提供了一键启动脚本，无需分别运行前后端。

### 1. 环境准备

*   **Python**: 3.8+
*   **Node.js**: 18.0+ (推荐 20 LTS)

### 2. 安装依赖

**后端依赖**
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

**前端依赖**
```bash
cd frontend
npm install
# 返回根目录
cd ..
```

### 3. 运行项目

在项目根目录下运行启动脚本，它会自动启动 Flask API 和 Next.js 开发服务器，并自动打开浏览器。

```bash
# 确保虚拟环境已激活
python start_dev.py
```

*   **应用地址**: [http://localhost:3000](http://localhost:3000) (会自动打开)
*   **API 地址**: [http://localhost:5000](http://localhost:5000)

## 📂 目录结构

```
exif-rm-formater/
├── app.py              # Flask 后端主程序 (API 服务)
├── utils.py            # 图片处理与 EXIF 操作核心逻辑
├── start_dev.py        # 开发环境一键启动脚本 (Python + Node 并行)
├── requirements.txt    # Python 依赖清单
├── frontend/           # Next.js 前端项目源码
│   ├── app/            # 页面与路由 (App Router)
│   ├── components/     # React UI 组件
│   └── package.json    # 前端依赖配置
├── uploads/            # 临时存储：上传的原始文件 (自动清理)
└── processed/          # 临时存储：处理后的文件 (自动清理)
```

## 📝 API 文档

*   `POST /upload`: 上传图片
*   `POST /process`: 处理图片 (清除/修改/转换)
*   `POST /download_batch`: 打包下载
*   `GET /download/<file_id>`: 下载单个文件

## 🔧 自定义 EXIF JSON 格式

在使用“自定义导入”功能时，您需要提供一个符合以下格式的 JSON 字符串。
JSON 结构基于 EXIF 标准的 IFD (Image File Directory) 分组。

### 结构说明

*   **根对象**: 包含 `0th`, `Exif`, `GPS` 等顶级键。
*   **标签名**: 使用标准的 EXIF 英文标签名 (如 `Make`, `FNumber`)。
*   **数据类型**:
    *   **字符串 (String)**: 直接使用字符串，如 `"SONY"`。
    *   **数值 (Integer)**: 直接使用数字，如 `100`。
    *   **分数/比率 (Rational)**: 使用包含两个数字的数组 `[分子, 分母]`，如 `[1, 125]` 表示 1/125 秒。

### 示例代码

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

> **注意**:
> *   `FNumber`: `[28, 10]` = 2.8 光圈
> *   `ExposureTime`: `[1, 500]` = 1/500 秒快门
> *   `FocalLength`: `[500, 10]` = 50mm 焦距

---
License: MIT
