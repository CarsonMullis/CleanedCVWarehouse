// Manages 3D model viewing, file uploads, and model loading

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class DataPageManager {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.currentModel = null;
    this.viewerElement = null;
    this.statusElement = null;
    this.modelSelectElement = null;
  }

  init(viewerId = 'viewer') {
    this.viewerElement = document.getElementById(viewerId);
    this.statusElement = document.getElementById('status');
    this.modelSelectElement = document.getElementById('model-select');

    this.setupScene();
    this.setupRenderer();
    this.setupControls();
    this.setupLighting();
    this.animate();

    // Bind to window for global access
    window.loadModel = this.loadModel.bind(this);
    window.upload = this.upload.bind(this);
    window.uploadOBJ = this.uploadOBJ.bind(this);

    // Initial setup
    this.checkServerStatus();
    this.refreshModelList();
    this.setupResizeHandler();

    // Refresh model list on page load 
    window.addEventListener('load', this.refreshModelList.bind(this));
  }

  async checkServerStatus() {
    try {
      const response = await fetch('http://localhost:8000/status');
      if (response.ok) {
        const status = await response.json();
        const uploadBtn = document.querySelector('button[onclick="upload()"]');
        const imagesLabel = document.querySelector('label');
        
        if (!status.meshroom_available) {
          // Disable photogrammetry button
          uploadBtn.disabled = true;
          uploadBtn.style.opacity = '0.5';
          uploadBtn.style.cursor = 'not-allowed';
          uploadBtn.title = 'Meshroom not installed on this system. Use Upload OBJ instead.';
          
          if (imagesLabel) {
            imagesLabel.textContent = 'Images for Photogrammetry (Meshroom not available)';
          }
        }
      }
    } catch (err) {
      console.log('Could not check server status:', err);
    }
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.viewerElement.clientWidth / this.viewerElement.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 5);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.viewerElement.clientWidth,
      this.viewerElement.clientHeight
    );
    this.viewerElement.appendChild(this.renderer.domElement);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
  }

  setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setupResizeHandler() {
    window.addEventListener('resize', () => {
      this.camera.aspect = this.viewerElement.clientWidth / this.viewerElement.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(
        this.viewerElement.clientWidth,
        this.viewerElement.clientHeight
      );
    });
  }

  async refreshModelList() {
    this.modelSelectElement.innerHTML = '<option value="">Loading models...</option>';

    try {
      const response = await fetch('http://localhost:8000/models');
      if (!response.ok) {
        throw new Error('Failed to load model list');
      }
      const models = await response.json();
      this.modelSelectElement.innerHTML = '<option value="">Choose a model</option>';

      if (models.length === 0) {
        this.modelSelectElement.innerHTML = '<option value="">No models found</option>';
        this.statusElement.textContent = 'No models available';
        return;
      }

      for (const model of models) {
        const option = document.createElement('option');
        option.value = model.path;
        option.textContent = model.label;
        this.modelSelectElement.appendChild(option);
      }
      this.statusElement.textContent = 'Select a model to load';
    } catch (err) {
      this.modelSelectElement.innerHTML = '<option value="">Unable to load models</option>';
      this.statusElement.textContent = 'Could not fetch model list';
      console.error(err);
    }
  }

  loadModel() {
    const selected = this.modelSelectElement.value;
    if (!selected) {
      this.statusElement.textContent = 'No model selected';
      return;
    }

    this.statusElement.textContent = 'Loading...';
    const loader = new OBJLoader();
    const url = `http://localhost:8000/model?path=${encodeURIComponent(selected)}`;

    loader.load(
      url,
      (obj) => {
        if (this.currentModel) {
          this.scene.remove(this.currentModel);
        }
        this.currentModel = obj;

        // Center the model
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center);

        // Scale to fit view
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        obj.scale.setScalar(3 / maxDim);

        this.scene.add(obj);
        this.statusElement.textContent = 'Model loaded!';
      },
      undefined,
      (err) => {
        this.statusElement.textContent = 'Failed to load model';
        console.error(err);
      }
    );
  }

  async uploadOBJ() {
    const objFilesInput = document.getElementById('obj-files');
    const modelNameInput = document.getElementById('model-name');
    const files = objFilesInput.files;
    const customName = modelNameInput.value.trim();

    if (!files.length) {
      this.statusElement.textContent = 'No OBJ files selected';
      return;
    }

    // Validate all files are OBJ files
    for (const f of files) {
      if (!f.name.toLowerCase().endsWith('.obj')) {
        this.statusElement.textContent = `File "${f.name}" is not an OBJ file`;
        return;
      }
    }

    const form = new FormData();
    for (const f of files) {
      form.append('obj_files', f);
    }

    if (customName) {
      form.append('name', customName);
    }

    this.statusElement.textContent = 'Uploading OBJ files...';
    try {
      const res = await fetch('http://localhost:8000/upload-obj', {
        method: 'POST',
        body: form
      });

      if (res.ok) {
        const result = await res.json();
        this.statusElement.textContent = result.message || 'OBJ files uploaded successfully!';
        modelNameInput.value = '';
        objFilesInput.value = '';
        this.refreshModelList();
      } else {
        const error = await res.json();
        this.statusElement.textContent = error.error || 'Upload failed';
      }
    } catch (error) {
      this.statusElement.textContent = 'Could not reach server';
      console.error(error);
    }
  }

  async upload() {
    const filesInput = document.getElementById('files');
    const modelNameInput = document.getElementById('model-name');
    const files = filesInput.files;
    const customName = modelNameInput.value.trim();

    if (!files.length) {
      this.statusElement.textContent = 'No files selected';
      return;
    }

    // Validate that files are images, not OBJ
    for (const f of files) {
      if (f.name.toLowerCase().endsWith('.obj')) {
        this.statusElement.textContent = 'Use "Upload OBJ" button for OBJ files';
        return;
      }
    }

    const form = new FormData();
    for (const f of files) {
      form.append('images', f);
    }

    if (customName) {
      form.append('name', customName);
    }

    this.statusElement.textContent = 'Processing images with Meshroom...';
    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: form
      });
      if (res.ok) {
        this.statusElement.textContent = 'Done! Click Load Model.';
        modelNameInput.value = '';
        filesInput.value = '';
        this.refreshModelList();
      } else {
        const errorText = await res.text();
        this.statusElement.textContent = errorText || 'Server error';
      }
    } catch {
      this.statusElement.textContent = 'Could not reach server';
    }
  }
}

// Export for use in HTML
export default DataPageManager;
