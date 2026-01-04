import os
import json
import shutil
import piexif
from PIL import Image

def get_exif_data(image_path):
    """
    Extracts EXIF data from an image and returns a readable dictionary.
    """
    try:
        with Image.open(image_path) as img:
            exif_bytes = img.info.get("exif")
            if not exif_bytes:
                return {}
            
            exif_dict = piexif.load(exif_bytes)
        
        # Convert bytes to string for JSON serialization where possible
        readable_exif = {}
        for ifd in ("0th", "Exif", "GPS", "1st"):
            if ifd in exif_dict:
                readable_exif[ifd] = {}
                for tag in exif_dict[ifd]:
                    tag_name = piexif.TAGS[ifd][tag]["name"]
                    value = exif_dict[ifd][tag]
                    if isinstance(value, bytes):
                        try:
                            value = value.decode('utf-8')
                        except:
                            value = f"<bytes: {len(value)}>"
                    readable_exif[ifd][tag_name] = value
        return readable_exif
    except Exception as e:
        print(f"Error reading EXIF: {e}")
        return {}

def remove_exif(image_path, output_path):
    """
    Removes EXIF data from an image.
    Attempts to be lossless for JPEG.
    """
    try:
        # Check if JPEG
        is_jpeg = False
        try:
            with Image.open(image_path) as img:
                if img.format == 'JPEG':
                    is_jpeg = True
        except:
            pass

        if is_jpeg:
            # Lossless removal for JPEG using piexif
            shutil.copy(image_path, output_path)
            try:
                piexif.remove(output_path)
                return True
            except Exception as e:
                print(f"piexif remove failed: {e}, falling back to PIL")
                # Fallback to PIL if piexif fails
        
        # Fallback / Non-JPEG handling
        with Image.open(image_path) as img:
            # Create a new image without EXIF by pasting
            # For PNG/WebP this re-encodes but strips metadata
            image_without_exif = Image.new(img.mode, img.size)
            image_without_exif.paste(img)
            # Save with high quality
            img.save(output_path, quality=100, subsampling=0)
        return True
    except Exception as e:
        print(f"Error removing EXIF: {e}")
        return False

def modify_exif(image_path, output_path, exif_json_path=None, preset_data=None, convert_to_jpg=False):
    """
    Modifies EXIF data of an image using a JSON file or preset data.
    Attempts to be lossless for JPEG unless convert_to_jpg is True.
    """
    try:
        if exif_json_path:
            with open(exif_json_path, 'r', encoding='utf-8') as f:
                target_exif = json.load(f)
        elif preset_data:
            target_exif = preset_data
        else:
            return False

        # Construct piexif compatible dictionary
        exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": None}
        
        def convert_value(tag_type, value):
            # Helper to convert list to tuple recursively
            def to_tuple(val):
                if isinstance(val, list):
                    return tuple(to_tuple(i) for i in val)
                return val

            if tag_type == 2:  # Ascii
                if isinstance(value, str):
                    return value.encode('utf-8')
            elif tag_type in (5, 10):  # Rational, SRational
                # Single Rational: [1, 2] -> (1, 2)
                # Array of Rationals: [[1,1], [2,1]] -> ((1,1), (2,1))
                return to_tuple(value)
            elif tag_type == 7: # Undefined
                if isinstance(value, str):
                    return value.encode('utf-8')
            
            return value

        def map_keys_to_id(ifd_name, data_dict):
            mapped = {}
            if ifd_name not in piexif.TAGS:
                return {}
            
            name_to_id = {info["name"]: tag for tag, info in piexif.TAGS[ifd_name].items()}
            tag_types = {tag: info.get("type") for tag, info in piexif.TAGS[ifd_name].items()}
            
            for k, v in data_dict.items():
                if k in name_to_id:
                    tag_id = name_to_id[k]
                    tag_type = tag_types.get(tag_id)
                    
                    try:
                        converted_v = convert_value(tag_type, v)
                        mapped[tag_id] = converted_v
                    except Exception as conv_e:
                        print(f"Warning: Failed to convert tag {k}: {conv_e}")
                        mapped[tag_id] = v
            return mapped

        if "0th" in target_exif:
            exif_dict["0th"] = map_keys_to_id("0th", target_exif["0th"])
        if "Exif" in target_exif:
            exif_dict["Exif"] = map_keys_to_id("Exif", target_exif["Exif"])
        if "GPS" in target_exif:
                exif_dict["GPS"] = map_keys_to_id("GPS", target_exif["GPS"])
                
        exif_bytes = piexif.dump(exif_dict)
        
        # Check format
        is_jpeg = False
        if not convert_to_jpg:
            try:
                with Image.open(image_path) as img:
                    if img.format == 'JPEG':
                        is_jpeg = True
            except:
                pass

        if convert_to_jpg:
             with Image.open(image_path) as img:
                rgb_im = img.convert('RGB')
                rgb_im.save(output_path, "JPEG", exif=exif_bytes, quality=95)
        elif is_jpeg:
            # Lossless insert for JPEG
            shutil.copy(image_path, output_path)
            piexif.insert(exif_bytes, output_path)
        else:
            # Re-save for others
            with Image.open(image_path) as img:
                img.save(output_path, exif=exif_bytes, quality=100, subsampling=0)
                
        return True
    except Exception as e:
        print(f"Error modifying EXIF: {e}")
        return False

def create_thumbnail(image_path, output_path, size=(200, 200)):
    try:
        with Image.open(image_path) as img:
            img.thumbnail(size)
            img.save(output_path)
        return True
    except Exception as e:
        print(f"Error creating thumbnail: {e}")
        return False
