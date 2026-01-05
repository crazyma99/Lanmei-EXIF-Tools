import os
import uuid
import zipfile
import json
import sys
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
from werkzeug.utils import secure_filename
import utils
from PIL import Image

def resource_path(relative: str) -> str:
    base_path = getattr(sys, '_MEIPASS', os.path.abspath('.'))
    return os.path.join(base_path, relative)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.abspath('uploads')
app.config['PROCESSED_FOLDER'] = os.path.abspath('processed')
app.config['THUMBNAIL_FOLDER'] = os.path.abspath('static/thumbnails')
app.config['PRESETS_FOLDER'] = resource_path('presets')
app.config['WEB_FOLDER'] = resource_path('web')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max upload

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)
os.makedirs(app.config['THUMBNAIL_FOLDER'], exist_ok=True)
os.makedirs(app.config['PRESETS_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'tiff', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Origin'] = origin if origin else '*'
    response.headers['Vary'] = 'Origin'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response


@app.route('/upload', methods=['POST', 'OPTIONS'])
def upload_file():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True}), 200
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_id = str(uuid.uuid4())
        ext = filename.rsplit('.', 1)[1].lower()
        save_name = f"{file_id}.{ext}"
        
        # Ensure upload directory exists
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], save_name)
        file.save(file_path)

        # Generate thumbnail
        thumb_name = f"{file_id}_thumb.{ext}"
        thumb_path = os.path.join(app.config['THUMBNAIL_FOLDER'], thumb_name)
        utils.create_thumbnail(file_path, thumb_path)

        # Get EXIF data
        exif_data = utils.get_exif_data(file_path)
        aigc = utils.detect_aigc_from_exif(exif_data)
        try:
            with Image.open(file_path) as img:
                width, height = img.size
                fmt = img.format
        except:
            width, height, fmt = None, None, None
        try:
            print(f"文件 {filename} AIGC检测: {('是' if aigc['is_aigc'] else '否')}  匹配: {aigc.get('matched')}")
        except:
            pass

        return jsonify({
            'id': file_id,
            'filename': filename,
            'thumbnail_url': f"/static/thumbnails/{thumb_name}",
            'exif': exif_data,
            'aigc': aigc.get('is_aigc', False),
            'aigc_detail': aigc,
            'width': width,
            'height': height,
            'format': fmt
        })
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/process', methods=['POST', 'OPTIONS'])
def process_file():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True}), 200
    data = request.json
    file_id = data.get('id')
    action = data.get('action') # 'clear', 'import_preset', 'import_custom'
    
    if not file_id:
        return jsonify({'error': 'No file ID'}), 400

    # Find file
    upload_dir = app.config['UPLOAD_FOLDER']
    files = os.listdir(upload_dir)
    target_file = None
    for f in files:
        if f.startswith(file_id):
            target_file = f
            break
    
    if not target_file:
        return jsonify({'error': 'File not found'}), 404

    input_path = os.path.join(upload_dir, target_file)
    
    # Handle convert to jpg
    convert_to_jpg = data.get('convert_to_jpg', False)
    clear_aigc = data.get('clear_aigc', False)
    
    if convert_to_jpg:
        output_filename = os.path.splitext(target_file)[0] + '.jpg'
    else:
        output_filename = target_file
        
    output_path = os.path.join(app.config['PROCESSED_FOLDER'], output_filename)
    
    # Cleanup existing processed files with same ID to avoid ambiguity
    for f in os.listdir(app.config['PROCESSED_FOLDER']):
        if f.startswith(file_id) and f != output_filename:
            try:
                os.remove(os.path.join(app.config['PROCESSED_FOLDER'], f))
            except:
                pass

    success = False
    
    if action == 'clear':
        success = utils.remove_exif(input_path, output_path)
    
    elif action == 'import_preset':
        preset_name = data.get('preset')
        preset_path = os.path.join(app.config['PRESETS_FOLDER'], f"{preset_name}.json")
        if os.path.exists(preset_path):
            with open(preset_path, 'r', encoding='utf-8') as f:
                preset_data = json.load(f)
            success = utils.modify_exif(input_path, output_path, preset_data=preset_data, convert_to_jpg=convert_to_jpg)
        else:
            return jsonify({'error': 'Preset not found'}), 404
            
    elif action == 'import_custom':
        custom_data = data.get('custom_data')
        if custom_data:
            success = utils.modify_exif(input_path, output_path, preset_data=custom_data, convert_to_jpg=convert_to_jpg)
        else:
            return jsonify({'error': 'No custom data provided'}), 400
            
    else:
        return jsonify({'error': 'Invalid action'}), 400

    if success:
        if clear_aigc:
            try:
                # Apply AIGC strip on the processed output
                strip_ok = utils.strip_aigc_metadata(output_path, output_path)
                if not strip_ok:
                    print("Warning: strip_aigc_metadata failed")
            except Exception as e:
                print(f"strip_aigc_metadata error: {e}")
        # Get new EXIF
        new_exif = utils.get_exif_data(output_path)
        new_aigc = utils.detect_aigc_from_exif(new_exif)
        try:
            with Image.open(output_path) as img:
                n_width, n_height = img.size
                n_fmt = img.format
        except:
            n_width, n_height, n_fmt = None, None, None
        
        # Return new filename if changed
        return jsonify({
            'success': True, 
            'exif': new_exif,
            'new_filename': output_filename if convert_to_jpg else None,
            'aigc': new_aigc.get('is_aigc', False),
            'aigc_detail': new_aigc,
            'width': n_width,
            'height': n_height,
            'format': n_fmt
        })
    else:
        return jsonify({'error': 'Processing failed'}), 500

@app.route('/download/<file_id>', methods=['GET', 'OPTIONS'])
def download_file(file_id):
    if request.method == 'OPTIONS':
        return jsonify({'ok': True}), 200
    processed_dir = app.config['PROCESSED_FOLDER']
    files = os.listdir(processed_dir)
    target_file = None
    for f in files:
        if f.startswith(file_id):
            target_file = f
            break
            
    if target_file:
        return send_from_directory(processed_dir, target_file, as_attachment=True)
    return jsonify({'error': 'File not found'}), 404

@app.route('/download_batch', methods=['POST', 'OPTIONS'])
def download_batch():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True}), 200
    data = request.json
    file_ids = data.get('ids', [])
    
    if not file_ids:
        return jsonify({'error': 'No files selected'}), 400

    zip_filename = f"batch_download_{uuid.uuid4()}.zip"
    zip_path = os.path.join(app.config['PROCESSED_FOLDER'], zip_filename)
    
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for file_id in file_ids:
            # Find file in processed
            processed_dir = app.config['PROCESSED_FOLDER']
            files = os.listdir(processed_dir)
            target_file = None
            for f in files:
                if f.startswith(file_id) and not f.endswith('.zip'):
                    target_file = f
                    break
            
            if target_file:
                file_path = os.path.join(processed_dir, target_file)
                zipf.write(file_path, target_file)
    
    return send_file(zip_path, as_attachment=True)

@app.route('/static/thumbnails/<path:filename>')
def serve_thumbnails(filename):
    return send_from_directory(app.config['THUMBNAIL_FOLDER'], filename)

@app.route('/api')
def api_root():
    return jsonify({'status': 'online', 'message': 'Exif-Rm-Formater API Server', 'version': '1.0.0'}), 200

@app.route('/')
@app.route('/app')
def serve_ui_index():
    index_path = os.path.join(app.config['WEB_FOLDER'], 'index.html')
    if os.path.exists(index_path):
        return send_file(index_path)
    return jsonify({'message': 'UI not built. Please use GitHub Releases version or build frontend.'}), 200

@app.route('/_next/<path:path>')
def serve_nextjs_assets(path):
    return send_from_directory(os.path.join(app.config['WEB_FOLDER'], '_next'), path)

@app.route('/app/<path:filename>')
def serve_ui_assets(filename):
    return send_from_directory(app.config['WEB_FOLDER'], filename)

if __name__ == '__main__':
    try:
        import webbrowser
        webbrowser.open('http://127.0.0.1:5000/app')
    except:
        pass
    app.run(debug=False, port=5000)
