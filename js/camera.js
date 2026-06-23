(function () {
  'use strict';

  const MAX_PHOTOS = 3;
  const MAX_EDGE = 1600;
  const JPEG_QUALITY = 0.75;
  const MAX_COMPRESSED_BYTES = 5 * 1024 * 1024;

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isHeic(file) {
    return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('画像ファイルを読み込めませんでした。'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('この画像形式はブラウザで処理できません。JPEG形式で撮影・選択してください。'));
      image.src = dataUrl;
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('画像の縮小処理に失敗しました。'));
      }, 'image/jpeg', JPEG_QUALITY);
    });
  }

  async function compress(file) {
    if (!file.type.startsWith('image/') && !isHeic(file)) {
      throw new Error(`${file.name} は画像ファイルではありません。`);
    }

    const source = await readAsDataUrl(file);
    let image;
    try {
      image = await loadImage(source);
    } catch (error) {
      if (isHeic(file)) {
        throw new Error(`${file.name} はこのブラウザで変換できません。カメラ設定をJPEGに変更して再度撮影してください。`);
      }
      throw error;
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas);
    if (blob.size > MAX_COMPRESSED_BYTES) {
      throw new Error(`${file.name} は縮小後も大きすぎます。別の写真を選択してください。`);
    }

    const dataUrl = await readAsDataUrl(blob);
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg',
      mimeType: 'image/jpeg',
      base64Data: dataUrl.split(',')[1],
      previewUrl: dataUrl,
      originalSize: file.size,
      compressedSize: blob.size,
      width,
      height
    };
  }

  class PhotoManager {
    constructor(input, preview, count, error) {
      this.input = input;
      this.preview = preview;
      this.count = count;
      this.error = error;
      this.photos = [];
      input.addEventListener('change', () => this.addFiles(input.files));
      preview.addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-photo]');
        if (button) this.remove(button.dataset.removePhoto);
      });
    }

    async addFiles(fileList) {
      this.showError('');
      const files = Array.from(fileList);
      const remaining = MAX_PHOTOS - this.photos.length;
      if (files.length > remaining) {
        this.showError(`写真は最大${MAX_PHOTOS}枚です。先頭の${remaining}枚を処理します。`);
      }

      for (const file of files.slice(0, remaining)) {
        try {
          this.photos.push(await compress(file));
          this.render();
        } catch (error) {
          this.showError(error.message);
        }
      }
      this.input.value = '';
    }

    remove(id) {
      this.photos = this.photos.filter((photo) => photo.id !== id);
      this.render();
    }

    clear() {
      this.photos = [];
      this.input.value = '';
      this.showError('');
      this.render();
    }

    getPayload() {
      return this.photos.map(({ fileName, mimeType, base64Data, originalSize, compressedSize }) => ({
        fileName,
        mimeType,
        base64Data,
        originalSize,
        compressedSize
      }));
    }

    showError(message) {
      this.error.textContent = message;
    }

    render() {
      this.preview.replaceChildren();
      this.count.textContent = `${this.photos.length} / ${MAX_PHOTOS}枚`;
      for (const photo of this.photos) {
        const card = document.createElement('article');
        card.className = 'photo-card';
        const image = document.createElement('img');
        image.src = photo.previewUrl;
        image.alt = `選択した写真：${photo.fileName}`;
        const info = document.createElement('div');
        info.className = 'photo-info';
        const text = document.createElement('p');
        text.textContent = `${photo.fileName}（${formatBytes(photo.compressedSize)}）`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'remove-photo';
        button.dataset.removePhoto = photo.id;
        button.textContent = '削除';
        button.setAttribute('aria-label', `${photo.fileName}を削除`);
        info.append(text, button);
        card.append(image, info);
        this.preview.append(card);
      }
    }
  }

  window.PhotoManager = PhotoManager;
})();
