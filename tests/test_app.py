import unittest
import os
import sys
import json
import io
import piexif
from PIL import Image

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

class ExifToolTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'test_uploads')
        app.config['PROCESSED_FOLDER'] = os.path.join(os.path.dirname(__file__), 'test_processed')
        app.config['THUMBNAIL_FOLDER'] = os.path.join(os.path.dirname(__file__), 'test_thumbnails')
        
        # Ensure test dirs exist
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)
        os.makedirs(app.config['THUMBNAIL_FOLDER'], exist_ok=True)
        
        self.app = app.test_client()
        self.test_image_path = os.path.join(os.path.dirname(__file__), 'test_image.jpg')
        self.create_test_image()

    def tearDown(self):
        # Clean up files - optional, maybe keep for inspection
        pass

    def create_test_image(self):
        # Create a simple image with some EXIF
        img = Image.new('RGB', (100, 100), color = 'red')
        
        zeroth_ifd = {piexif.ImageIFD.Make: u"TestMaker",
                      piexif.ImageIFD.Model: u"TestModel"}
        exif_ifd = {piexif.ExifIFD.LensModel: u"TestLens"}
        exif_dict = {"0th":zeroth_ifd, "Exif":exif_ifd, "GPS":{}, "1st":{}, "thumbnail":None}
        exif_bytes = piexif.dump(exif_dict)
        
        img.save(self.test_image_path, exif=exif_bytes)

    def test_upload_file(self):
        with open(self.test_image_path, 'rb') as img:
            data = {'file': (img, 'test_image.jpg')}
            response = self.app.post('/upload', data=data, content_type='multipart/form-data')
            self.assertEqual(response.status_code, 200)
            json_data = response.get_json()
            self.assertIn('id', json_data)
            self.assertIn('exif', json_data)
            self.assertEqual(json_data['exif']['0th']['Make'], 'TestMaker')
            return json_data['id']

    def test_clear_exif(self):
        file_id = self.test_upload_file()
        response = self.app.post('/process', json={'id': file_id, 'action': 'clear'})
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['success'], True)
        self.assertEqual(json_data['exif'], {}) # Should be empty

    def test_import_preset(self):
        file_id = self.test_upload_file()
        # Ensure presets exist in the main app path, or we need to mock/copy them
        # app.py uses absolute path for presets, so it should work if we run from root
        response = self.app.post('/process', json={'id': file_id, 'action': 'import_preset', 'preset': 'sony_a7m4'})
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['success'], True)
        self.assertEqual(json_data['exif']['0th']['Make'], 'SONY')

    def test_import_custom(self):
        file_id = self.test_upload_file()
        custom_data = {
            "0th": {"Make": "CustomMaker", "Model": "CustomModel"},
            "Exif": {}
        }
        response = self.app.post('/process', json={
            'id': file_id, 
            'action': 'import_custom', 
            'custom_data': custom_data
        })
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['success'], True)
        self.assertEqual(json_data['exif']['0th']['Make'], 'CustomMaker')

    def test_download_batch(self):
        file_id1 = self.test_upload_file()
        # process it so it exists in processed folder (logic requires file to be in processed for download?)
        # Actually app.py download logic checks processed folder. 
        # But /process puts it there. So we must process first.
        self.app.post('/process', json={'id': file_id1, 'action': 'clear'})
        
        response = self.app.post('/download_batch', json={'ids': [file_id1]})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content_type in ['application/zip', 'application/x-zip-compressed'])

if __name__ == '__main__':
    unittest.main()
