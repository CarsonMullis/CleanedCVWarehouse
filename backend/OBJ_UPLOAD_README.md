# CV Warehouse Upload Options

This document explains the two ways to upload 3D models to the CV Warehouse server.

## Option 1: Photogrammetry Processing (Images -> 3D Model)

Use the "Upload & Process" button to create 3D models from images using Meshroom.

### Web Interface
1. Select multiple images (JPG, PNG, etc.)
2. (Optional) Enter a custom name
3. Click "Upload & Process"
4. Meshroom will process the images and create a 3D model

## Option 2: Direct OBJ File Upload

Use the "Upload OBJ" button to upload pre-existing OBJ files directly.

### Web Interface
1. Select OBJ files
2. (Optional) Enter a custom name
3. Click "Upload OBJ"
4. Files are uploaded immediately without processing

### Command Line Script

Use the `upload_obj.py` script to upload OBJ files from the command line:

```bash
# Basic usage
python upload_obj.py my_model.obj

# Upload multiple files
python upload_obj.py model1.obj model2.obj

# Upload with custom name
python upload_obj.py my_model.obj --name "My Custom Model"

# Upload to different server
python upload_obj.py my_model.obj --server http://192.168.1.100:8000

# Upload all OBJ files in current directory
python upload_obj.py *.obj
```

## File Locations

### Photogrammetry Models (Meshroom)
- **Cache**: `C:\Users\[username]\AppData\Local\Temp\MeshroomCache\`
- **Custom names**: Stored in metadata

### Direct OBJ Uploads
- **Location**: `backend/output/` directory
- **Metadata**: `backend/output/models_metadata.json`

## Requirements

- Python 3.x
- requests library (`pip install requests`)
- Running CV Warehouse server on port 8000
- For photogrammetry: Meshroom installation
