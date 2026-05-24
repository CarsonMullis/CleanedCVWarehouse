#!/usr/bin/env python3
"""
Usage:
    python upload_obj.py file.obj [file2.obj ...] [--name "Custom Name"] [--server http://localhost:8000]
"""

import argparse
import requests
import os
import sys

def upload_obj_files(files, custom_name=None, server_url="http://localhost:8000"):
    """Upload OBJ files"""

    # Validate files exist and are OBJ files
    valid_files = []
    for file_path in files:
        if not os.path.exists(file_path):
            print(f"Error: File '{file_path}' does not exist")
            continue
        if not file_path.lower().endswith('.obj'):
            print(f"Error: File '{file_path}' is not an OBJ file")
            continue
        valid_files.append(file_path)

    if not valid_files:
        print("No valid OBJ files to upload")
        return False

    files_data = []
    for file_path in valid_files:
        files_data.append(('obj_files', (os.path.basename(file_path), open(file_path, 'rb'), 'application/octet-stream')))

    data = {}
    if custom_name:
        data['name'] = custom_name

    try:
        print(f"Uploading {len(valid_files)} OBJ file(s) to {server_url}...")
        if custom_name:
            print(f"Custom name: {custom_name}")

        response = requests.post(f"{server_url}/upload-obj", files=files_data, data=data)

        if response.status_code == 200:
            result = response.json()
            print("Success!")
            print(f"Message: {result.get('message', 'Upload completed')}")
            if result.get('files'):
                print("Uploaded files:")
                for filename in result['files']:
                    print(f"  - {filename}")
            if result.get('custom_name'):
                print(f"Custom name applied: {result['custom_name']}")
            return True
        else:
            print(f"Upload failed (HTTP {response.status_code})")
            try:
                error_data = response.json()
                print(f"Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"Response: {response.text}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"Connection error: {e}")
        return False
    finally:
        # Close all file handles
        for _, file_tuple in files_data:
            file_tuple[1].close()

def main():
    parser = argparse.ArgumentParser(
        description="Upload OBJ files to CV Warehouse server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument('files', nargs='+', help='OBJ files to upload')
    parser.add_argument('--name', '-n', help='Custom name for the model(s)')
    parser.add_argument('--server', '-s', default='http://localhost:8000',
                       help='Server URL (default: http://localhost:8000)')

    args = parser.parse_args()

    success = upload_obj_files(args.files, args.name, args.server)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
