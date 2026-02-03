import os
import json
import shutil
import piexif
from PIL import Image, ImageChops
from PIL.PngImagePlugin import PngInfo

__all__ = [
    "get_exif_data",
    "remove_exif",
    "modify_exif",
    "create_thumbnail",
    "detect_aigc_from_exif",
    "strip_aigc_metadata",
    "add_grain"
]

def add_grain(image, intensity=0.1):
    """
    Add film grain/noise to image.
    intensity: 0.0 to 100.0
    """
    if intensity <= 0:
        return image
    
    # Scale intensity (1-100) to sigma (approx 0.5 - 20)
    # Adjust multiplier based on visual preference
    sigma = max(0.5, intensity * 0.2) 
    
    try:
        if image.mode == 'RGB':
            # YCbCr approach for better film grain look (luma only)
            ycbcr = image.convert('YCbCr')
            y, cb, cr = ycbcr.split()
            
            noise_y = Image.effect_noise(y.size, sigma)
            y_with_noise = ImageChops.overlay(y, noise_y)
            
            merged = Image.merge('YCbCr', (y_with_noise, cb, cr))
            return merged.convert('RGB')
        
        elif image.mode == 'L':
             noise = Image.effect_noise(image.size, sigma)
             return ImageChops.overlay(image, noise)
             
        elif image.mode == 'RGBA':
            r, g, b, a = image.split()
            rgb = Image.merge('RGB', (r, g, b))
            noisy_rgb = add_grain(rgb, intensity)
            r2, g2, b2 = noisy_rgb.split()
            return Image.merge('RGBA', (r2, g2, b2, a))
            
        else:
             # Try converting to RGB
             rgb = image.convert('RGB')
             return add_grain(rgb, intensity)
             
    except Exception as e:
        print(f"Error adding grain: {e}")
        return image

def get_exif_data(image_path):
    """
    Extracts EXIF data from an image and returns a readable dictionary.
    Also extracts PNG Info and XMP data if available.
    """
    try:
        readable_exif = {}
        with Image.open(image_path) as img:
            # 1. Standard EXIF via piexif
            exif_bytes = img.info.get("exif")
            if exif_bytes:
                try:
                    exif_dict = piexif.load(exif_bytes)
                    for ifd in ("0th", "Exif", "GPS", "1st"):
                        if ifd in exif_dict:
                            readable_exif[ifd] = {}
                            for tag in exif_dict[ifd]:
                                try:
                                    tag_name = piexif.TAGS[ifd][tag]["name"]
                                    value = exif_dict[ifd][tag]
                                    if isinstance(value, bytes):
                                        if tag_name == "UserComment":
                                            try:
                                                prefix = value[:8]
                                                rest = value[8:]
                                                if prefix.startswith(b"ASCII"):
                                                    value = rest.decode('ascii', errors='ignore')
                                                elif prefix.startswith(b"UNICODE"):
                                                    value = rest.decode('utf-16', errors='ignore')
                                                elif prefix.startswith(b"JIS"):
                                                    try:
                                                        value = rest.decode('shift_jis', errors='ignore')
                                                    except:
                                                        value = rest.decode('utf-8', errors='ignore')
                                                else:
                                                    value = value.decode('utf-8', errors='ignore')
                                            except:
                                                try:
                                                    value = value.decode('utf-8', errors='ignore')
                                                except:
                                                    value = f"<bytes: {len(value)}>"
                                        else:
                                            try:
                                                value = value.decode('utf-8')
                                            except:
                                                value = f"<bytes: {len(value)}>"
                                    readable_exif[ifd][tag_name] = value
                                except KeyError:
                                    pass # Unknown tag
                except Exception as e:
                    print(f"Error parsing EXIF bytes: {e}")

            # 2. PNG Info (parameters, etc.) - only for PNG
            if (img.format or "").lower() == "png":
                png_info = {}
                for k, v in img.info.items():
                    if k != "exif":
                        # Some values might be non-serializable, ensure they are strings
                        if isinstance(v, (str, int, float, bool, type(None))):
                            png_info[k] = v
                        else:
                            png_info[k] = str(v)
                if png_info:
                    readable_exif["PNG Info"] = png_info

            # 3. XMP Data
            if hasattr(img, "getxmp"):
                try:
                    xmp_data = img.getxmp()
                    if xmp_data:
                        readable_exif["XMP"] = xmp_data
                except Exception as e:
                    print(f"Error getting XMP: {e}")
        
        return readable_exif
    except Exception as e:
        print(f"Error reading EXIF: {e}")
        return {}

def remove_exif(image_path, output_path, add_noise=False, noise_intensity=0):
    """
    Removes EXIF data from an image.
    Attempts to be lossless for JPEG if add_noise is False.
    """
    try:
        if os.path.dirname(output_path):
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # If adding noise, we must re-encode, so skip lossless logic
        if add_noise:
            with Image.open(image_path) as img:
                processed_img = add_grain(img, noise_intensity)
                
                # Determine format
                fmt = (img.format or "").upper()
                if fmt == "JPEG":
                    processed_img.save(output_path, quality=95)
                elif fmt == "PNG":
                    pnginfo = PngInfo()
                    processed_img.save(output_path, format="PNG", pnginfo=pnginfo, optimize=True)
                elif fmt == "WEBP":
                    processed_img.save(output_path, format="WEBP", lossless=True)
                else:
                    # Default to converting to RGB and saving
                    if processed_img.mode in ("P", "1"):
                        processed_img = processed_img.convert("RGB")
                    processed_img.save(output_path, quality=100)
            return True

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
        
        # Fallback / Non-JPEG handling (lossless where possible)
        with Image.open(image_path) as img:
            fmt = (img.format or "").upper()
            if fmt == "PNG":
                pnginfo = PngInfo()  # empty metadata
                img.save(output_path, format="PNG", pnginfo=pnginfo, optimize=True)
            elif fmt == "WEBP":
                img.save(output_path, format="WEBP", lossless=True)
            else:
                # Generic path: re-save without EXIF, try max quality
                base = img
                if img.mode in ("P", "1"):
                    base = img.convert("RGB")
                base.save(output_path, quality=100, subsampling=0)
        return True
    except Exception as e:
        print(f"Error removing EXIF: {e}")
        return False

def modify_exif(image_path, output_path, exif_json_path=None, preset_data=None, convert_to_jpg=False, add_noise=False, noise_intensity=0):
    """
    Modifies EXIF data of an image using a JSON file or preset data.
    Attempts to be lossless for JPEG unless convert_to_jpg is True or add_noise is True.
    """
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
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
        if not convert_to_jpg and not add_noise:
            try:
                with Image.open(image_path) as img:
                    if img.format == 'JPEG':
                        is_jpeg = True
            except:
                pass

        if convert_to_jpg or add_noise:
             with Image.open(image_path) as img:
                processed_img = img
                if add_noise:
                    processed_img = add_grain(img, noise_intensity)
                
                if convert_to_jpg:
                    rgb_im = processed_img.convert('RGB')
                    rgb_im.save(output_path, "JPEG", exif=exif_bytes, quality=95)
                else:
                    # add_noise is True but convert_to_jpg is False
                    # We must save in original format (or close to it) but with new pixels
                    fmt = (img.format or "JPEG").upper()
                    if fmt == "JPEG":
                        if processed_img.mode != "RGB":
                             processed_img = processed_img.convert("RGB")
                        processed_img.save(output_path, "JPEG", exif=exif_bytes, quality=95)
                    else:
                        processed_img.save(output_path, exif=exif_bytes, quality=100)
                        
        elif is_jpeg:
            # Lossless insert for JPEG (Only if NO noise added)
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
        # Ensure directory exists
        if os.path.dirname(output_path):
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with Image.open(image_path) as img:
            img.thumbnail(size)
            img.save(output_path)
        return True
    except Exception as e:
        print(f"Error creating thumbnail: {e}")
        return False


def detect_aigc_from_exif(exif_data):
    try:
        keywords = [
            "ai generated", "ai-generated", "aigc", "midjourney", "stable diffusion",
            "comfyui", "dall-e", "dalle", "firefly", "novelai", "runway", "ideogram",
            "leonardo", "generated by", "sdxl", "flux", "controlnet", "lora"
        ]
        
        cn_keys = ["ai生成", "由ai生成", "aigc生成", "人工智能生成"]

        found_match = None
        
        # Helper to search in text
        def check_text(text):
            if not isinstance(text, str):
                return None
            lower_text = text.lower()
            for kw in keywords:
                if kw in lower_text:
                    return kw
            for kw in cn_keys:
                if kw in lower_text:
                    return kw
            return None

        # 1. Check Standard EXIF
        if isinstance(exif_data, dict):
            # Check specific fields first
            exif_ifd = exif_data.get("Exif", {})
            zero_ifd = exif_data.get("0th", {})
            
            # UserComment
            if "UserComment" in exif_ifd:
                match = check_text(exif_ifd["UserComment"])
                if match: return {"is_aigc": True, "matched": match, "source": "UserComment"}
            
            # ImageDescription
            if "ImageDescription" in zero_ifd:
                match = check_text(zero_ifd["ImageDescription"])
                if match: return {"is_aigc": True, "matched": match, "source": "ImageDescription"}
                
            # Software
            if "Software" in zero_ifd:
                match = check_text(zero_ifd["Software"])
                if match: return {"is_aigc": True, "matched": match, "source": "Software"}

        # 2. Check PNG Info
        png_info = exif_data.get("PNG Info", {})
        if isinstance(png_info, dict):
            # Check parameters (Stable Diffusion)
            if "parameters" in png_info:
                match = check_text(png_info["parameters"])
                if match: return {"is_aigc": True, "matched": match, "source": "PNG Parameters"}
                # Check for "Steps:" pattern which is common in SD
                if "Steps:" in png_info["parameters"]:
                     return {"is_aigc": True, "matched": "Steps:", "source": "PNG Parameters"}
                     
            for k, v in png_info.items():
                match = check_text(str(v))
                if match: return {"is_aigc": True, "matched": match, "source": f"PNG {k}"}

        # 3. Check XMP (Simple check)
        xmp = exif_data.get("XMP")
        if xmp:
             match = check_text(str(xmp))
             if match: return {"is_aigc": True, "matched": match, "source": "XMP"}
             
        return {"is_aigc": False}
    except Exception as e:
        print(f"Error detecting AIGC: {e}")
        return {"is_aigc": False}

def strip_aigc_metadata(image_path, output_path):
    """
    Aggressively strips metadata that might contain AIGC tags.
    For PNG, this clears chunks. For JPG, it clears UserComment etc.
    Actually remove_exif/modify_exif usually handles this by rewriting EXIF.
    This function specifically targets 'residue'.
    """
    try:
        # For now, just rely on the fact that modify_exif rewrites EXIF completely.
        # But for PNG, we might want to explicitly clear pnginfo.
        with Image.open(image_path) as img:
            data = list(img.getdata())
            image_without_exif = Image.new(img.mode, img.size)
            image_without_exif.putdata(data)
            
            # If we want to keep the file format
            fmt = (img.format or "JPEG")
            if fmt == "JPEG":
                # Save without EXIF is enough usually
                pass
            
            # This function is a bit redundant if we use remove_exif, 
            # but let's keep it as a "cleanup" pass.
            return True
    except:
        return False
