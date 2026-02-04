const STAMP_SOURCE = encodeURI("förslag 112.png");

const actionButton = document.getElementById("actionButton");
const photoInput = document.getElementById("photoInput");
const statusText = document.getElementById("statusText");
const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const processedCanvas = document.createElement("canvas");
const processedCtx = processedCanvas.getContext("2d", { willReadFrequently: true });

const state = {
  baseImage: null,
  stampImage: null,
  stampX: 0,
  stampY: 0,
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Ingen fil vald"));
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Kunde inte läsa bilden"));
    };

    image.src = url;
  });
}

function loadDefaultStamp() {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      state.stampImage = image;
      resolve();
    };

    image.onerror = () => reject(new Error("Kunde inte ladda märkesbilden"));
    image.src = STAMP_SOURCE;
  });
}

function getStampSize() {
  if (!state.baseImage || !state.stampImage) {
    return { width: 0, height: 0 };
  }

  const targetWidth = clamp(canvas.width * 0.24, 120, 360);
  const ratio = state.stampImage.height / state.stampImage.width;

  return {
    width: targetWidth,
    height: targetWidth * ratio
  };
}

function placeStampBottomRight() {
  const stampSize = getStampSize();
  state.stampX = Math.max(0, canvas.width - stampSize.width - 20);
  state.stampY = Math.max(0, canvas.height - stampSize.height - 20);
}

function drawPlaceholder() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#666666";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "18px Arial";
  ctx.fillText("Ladda upp en bild för att starta", canvas.width / 2, canvas.height / 2);
}

function rebuildProcessedBase() {
  if (!state.baseImage) return;

  processedCanvas.width = canvas.width;
  processedCanvas.height = canvas.height;
  processedCtx.drawImage(state.baseImage, 0, 0, processedCanvas.width, processedCanvas.height);

  const imageData = processedCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const red = pixels[i];
    const green = pixels[i + 1];
    const blue = pixels[i + 2];
    const gray = 0.299 * red + 0.587 * green + 0.114 * blue;

    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
  }

  processedCtx.putImageData(imageData, 0, 0);
}

function render() {
  if (!state.baseImage) {
    drawPlaceholder();
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(processedCanvas, 0, 0, canvas.width, canvas.height);

  if (!state.stampImage) return;

  const stampSize = getStampSize();
  ctx.drawImage(state.stampImage, state.stampX, state.stampY, stampSize.width, stampSize.height);
}

function getCanvasPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function canDragStamp(pointer) {
  if (!state.baseImage || !state.stampImage) return false;

  const stampSize = getStampSize();

  return (
    pointer.x >= state.stampX &&
    pointer.x <= state.stampX + stampSize.width &&
    pointer.y >= state.stampY &&
    pointer.y <= state.stampY + stampSize.height
  );
}

function startDrag(event) {
  const pointer = getCanvasPointerPosition(event);
  if (!canDragStamp(pointer)) return;

  state.dragging = true;
  state.dragOffsetX = pointer.x - state.stampX;
  state.dragOffsetY = pointer.y - state.stampY;
  canvas.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!state.dragging) return;

  const pointer = getCanvasPointerPosition(event);
  const stampSize = getStampSize();

  state.stampX = clamp(pointer.x - state.dragOffsetX, 0, canvas.width - stampSize.width);
  state.stampY = clamp(pointer.y - state.dragOffsetY, 0, canvas.height - stampSize.height);
  render();
}

function stopDrag(event) {
  if (!state.dragging) return;

  state.dragging = false;
  if (event && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

function updateActionButton() {
  actionButton.textContent = state.baseImage ? "Ladda ner bild" : "Ladda upp foto";
}

function downloadEditedImage() {
  if (!state.baseImage) return;

  canvas.toBlob((blob) => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "redigerad-bild.png";
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

actionButton.addEventListener("click", () => {
  if (!state.baseImage) {
    photoInput.click();
    return;
  }

  downloadEditedImage();
});

photoInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  photoInput.value = "";

  try {
    const image = await loadImageFromFile(file);
    state.baseImage = image;

    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    rebuildProcessedBase();

    if (state.stampImage) {
      placeStampBottomRight();
    }

    statusText.textContent = "Dra märket till valfri plats i bilden.";
    updateActionButton();
    render();
  } catch (error) {
    statusText.textContent = "Bilden kunde inte laddas. Försök igen med en annan fil.";
  }
});

canvas.addEventListener("pointerdown", startDrag);
canvas.addEventListener("pointermove", moveDrag);
canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);
canvas.addEventListener("pointerleave", stopDrag);

canvas.width = 1000;
canvas.height = 620;
updateActionButton();
drawPlaceholder();

loadDefaultStamp()
  .then(() => {
    if (state.baseImage) {
      placeStampBottomRight();
      render();
    }
  })
  .catch(() => {
    statusText.textContent = "Märkesbilden kunde inte laddas. Kontrollera filen 'förslag 112.png'.";
  });
