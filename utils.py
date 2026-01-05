import os
import json
import shutil
import piexif
from PIL import Image
from PIL.PngImagePlugin import PngInfo

__all__ = [
    "get_exif_data",
    "remove_exif",
    "modify_exif",
    "create_thumbnail",
    "detect_aigc_from_exif",
    "strip_aigc_metadata",
]
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
                if match: return {"is_aigc": True, "matched": match, "source": "PNG parameters"}
            
            # Check all values in PNG info
            for k, v in png_info.items():
                match = check_text(v)
                if match: return {"is_aigc": True, "matched": match, "source": f"PNG {k}"}

        # 3. Check XMP
        xmp_data = exif_data.get("XMP", {})
        
        def recursive_search(data):
            if isinstance(data, dict):
                for k, v in data.items():
                    res = recursive_search(v)
                    if res: return res
            elif isinstance(data, list):
                for item in data:
                    res = recursive_search(item)
                    if item: return res
            elif isinstance(data, str):
                return check_text(data)
            return None

        match = recursive_search(xmp_data)
        if match: return {"is_aigc": True, "matched": match, "source": "XMP"}

        return {"is_aigc": False, "matched": None, "source": None}
    except Exception as e:
        print(f"Error in AIGC detection: {e}")
        return {"is_aigc": False, "matched": None, "source": None}

def strip_aigc_metadata(image_path, output_path):
    try:
        with Image.open(image_path) as img:
            exif_bytes = img.info.get("exif")
            filtered_exif_bytes = None
            if exif_bytes:
                try:
                    exif_dict = piexif.load(exif_bytes)
                    # Remove UserComment
                    if "Exif" in exif_dict:
                        exif_ifd = exif_dict["Exif"]
                        name_to_id_exif = {info["name"]: tag for tag, info in piexif.TAGS["Exif"].items()}
                        uc_id = name_to_id_exif.get("UserComment")
                        if uc_id in exif_ifd:
                            exif_ifd.pop(uc_id, None)
                    # Remove ImageDescription / Software if AIGC-like
                    if "0th" in exif_dict:
                        zero_ifd = exif_dict["0th"]
                        name_to_id_0th = {info["name"]: tag for tag, info in piexif.TAGS["0th"].items()}
                        def is_aigc_text(val):
                            if not isinstance(val, (bytes, str)):
                                return False
                            try:
                                text = val.decode("utf-8", errors="ignore") if isinstance(val, bytes) else str(val)
                            except:
                                text = str(val)
                            lower = text.lower()
                            keys = [
                                "ai generated", "ai-generated", "aigc", "midjourney", "stable diffusion",
                                "comfyui", "dall-e", "dalle", "firefly", "novelai", "runway", "ideogram",
                                "leonardo", "generated by", "sdxl", "flux", "controlnet", "lora"
                            ]
                            cn = ["ai生成", "由ai生成", "aigc生成", "人工智能生成"]
                            return any(k in lower for k in keys) or any(k in lower for k in cn)
                        for field in ["ImageDescription", "Software"]:
                            tag_id = name_to_id_0th.get(field)
                            if tag_id in zero_ifd and is_aigc_text(zero_ifd[tag_id]):
                                zero_ifd.pop(tag_id, None)
                    filtered_exif_bytes = piexif.dump(exif_dict)
                except Exception as e:
                    print(f"Error filtering EXIF for AIGC removal: {e}")
                    filtered_exif_bytes = None

            format_lower = (img.format or "").lower()
            if format_lower == "png":
                pnginfo = PngInfo()
                remove_keys = {"parameters", "prompt", "workflow", "sd-metadata", "Comment", "Description", "Software"}
                for k, v in img.info.items():
                    if k == "exif":
                        continue
                    if k in remove_keys:
                        continue
                    try:
                        pnginfo.add_text(k, str(v))
                    except Exception:
                        pass
                img.save(output_path, pnginfo=pnginfo, exif=filtered_exif_bytes or b"", optimize=True)
            else:
                # JPEG path: prefer lossless update of EXIF, and strip XMP at segment level
                if format_lower == "jpeg":
                    shutil.copy(image_path, output_path)
                    try:
                        if filtered_exif_bytes:
                            piexif.insert(filtered_exif_bytes, output_path)
                    except Exception as e:
                        print(f"piexif.insert failed on strip: {e}")
                    try:
                        _strip_jpeg_xmp_inplace(output_path)
                    except Exception as e:
                        print(f"strip jpeg xmp failed: {e}")
                else:
                    # Other formats: attempt lossless options where available
                    try:
                        base = img
                        if img.mode in ("P", "1"):
                            base = img.convert("RGB")
                        if (img.format or "").upper() == "WEBP":
                            base.save(output_path, exif=filtered_exif_bytes or b"", lossless=True)
                        else:
                            base.save(output_path, exif=filtered_exif_bytes or b"", quality=100, subsampling=0)
                    except Exception as e:
                        print(f"Error saving after AIGC strip: {e}")
                        shutil.copy(image_path, output_path)
        return True
    except Exception as e:
        print(f"Error stripping AIGC metadata: {e}")
        return False

def _strip_jpeg_xmp_inplace(jpeg_path):
    # Remove APP1 XMP segments without re-encoding
    with open(jpeg_path, "rb") as f:
        data = f.read()
    if not data.startswith(b"\xFF\xD8"):
        return
    i = 2
    out = bytearray(b"\xFF\xD8")
    xmp_sig = b"http://ns.adobe.com/xap/1.0/\x00"
    sos_found = False
    while i < len(data):
        if data[i] != 0xFF:
            # Not a marker; corrupt?
            out.extend(data[i:])
            break
        # Skip fill bytes 0xFF
        while i < len(data) and data[i] == 0xFF:
            i += 1
        if i >= len(data):
            break
        marker = data[i]
        i += 1
        out.append(0xFF)
        out.append(marker)
        if marker == 0xDA:  # SOS
            sos_found = True
            out.extend(data[i:])  # copy rest (entropy-coded)
            break
        # Read segment length
        if i + 1 >= len(data):
            break
        seg_len = (data[i] << 8) | data[i + 1]
        seg_start = i + 2
        seg_end = seg_start + seg_len - 2
        if seg_end > len(data):
            break
        seg_payload = data[seg_start:seg_end]
        # If APP1 and payload starts with XMP signature, skip
        if marker == 0xE1 and seg_payload.startswith(xmp_sig):
            # Skip writing this segment
            i = seg_end
            continue
        # Otherwise write length and payload
        out.append(data[i])
        out.append(data[i + 1])
        out.extend(seg_payload)
        i = seg_end
    if sos_found:
        with open(jpeg_path, "wb") as f:
            f.write(out)
