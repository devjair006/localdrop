const form = document.getElementById("upload-form");
const pinInput = document.getElementById("pin");
const filesInput = document.getElementById("files");
const progressBar = document.getElementById("progress-bar");
const statusNode = document.getElementById("status");
const presenceNode = document.getElementById("presence");
const sharedListNode = document.getElementById("shared-list");
let deviceName = "dispositivo movil";
let currentPin = "";
const socket = window.io({
  transports: ["websocket", "polling"],
  query: {
    clientType: "mobile"
  }
});

socket.on("connect", () => {
  presenceNode.textContent = "Celular conectado a la sesion LocalDrop.";
});

socket.on("server:snapshot", (snapshot) => {
  presenceNode.textContent = `Conectado a ${snapshot.appName}. PIN activo listo para validar.`;
  renderSharedFiles(snapshot.sharedFiles);
});

socket.on("presence:ack", ({ deviceName }) => {
  deviceName = deviceName || "dispositivo movil";
  presenceNode.textContent = `${deviceName} vinculado con la app de escritorio.`;
});

pinInput.addEventListener("input", () => {
  currentPin = pinInput.value.trim();
});

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function renderSharedFiles(files) {
  if (!files?.length) {
    sharedListNode.innerHTML = '<li class="shared-empty">No hay archivos compartidos aun.</li>';
    return;
  }

  sharedListNode.innerHTML = files.map((file) => `
    <li class="shared-item">
      <div class="shared-item-info">
        <span class="shared-item-name">${file.name}</span>
        <span class="shared-item-size">${formatBytes(file.size)}</span>
      </div>
      <button type="button" data-filename="${file.name}">Descargar</button>
    </li>
  `).join("");

  sharedListNode.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      downloadSharedFile(button.dataset.filename);
    });
  });
}

function downloadSharedFile(fileName) {
  if (!currentPin) {
    statusNode.textContent = "Ingresa el PIN para descargar archivos del PC.";
    return;
  }

  const encodedName = encodeURIComponent(fileName);
  const downloadUrl = `/api/shared-files/download/${encodedName}?pin=${encodeURIComponent(currentPin)}`;
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  statusNode.textContent = `Descargando ${fileName}...`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  currentPin = pinInput.value.trim();

  if (!filesInput.files.length) {
    statusNode.textContent = "Selecciona al menos un archivo.";
    return;
  }

  const formData = new FormData();
  Array.from(filesInput.files).forEach((file) => {
    formData.append("files", file);
  });

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");
  xhr.setRequestHeader("x-localdrop-pin", pinInput.value.trim());
  xhr.setRequestHeader("x-localdrop-device-name", deviceName);
  statusNode.textContent = "Validando PIN y preparando transferencia...";
  progressBar.style.width = "0%";
  socket.emit("upload:started", { totalFiles: filesInput.files.length });

  let startTime = Date.now();
  let lastProgressEmit = 0;

  xhr.upload.addEventListener("progress", (progressEvent) => {
    if (!progressEvent.lengthComputable) {
      return;
    }

    const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
    progressBar.style.width = `${percent}%`;

    const elapsedTime = (Date.now() - startTime) / 1000;
    let speedFormatted = "0 B/s";
    if (elapsedTime > 0) {
      const speed = progressEvent.loaded / elapsedTime;
      if (speed < 1024) {
        speedFormatted = `${speed.toFixed(0)} B/s`;
      } else if (speed < 1024 * 1024) {
        speedFormatted = `${(speed / 1024).toFixed(1)} KB/s`;
      } else {
        speedFormatted = `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
      }
    }

    statusNode.textContent = `Subiendo... ${percent}% (${speedFormatted})`;

    const now = Date.now();
    if (now - lastProgressEmit < 250) {
      return;
    }
    lastProgressEmit = now;

    socket.emit("upload:progress", {
      progress: percent,
      speed: speedFormatted
    });
  });

  xhr.addEventListener("load", () => {
    progressBar.style.width = "100%";

    if (xhr.status >= 200 && xhr.status < 300) {
      const response = JSON.parse(xhr.responseText);
      statusNode.textContent = `Transferencia completada. ${response.uploaded.length} archivo(s) recibido(s).`;
      form.reset();
      return;
    }

    try {
      const response = JSON.parse(xhr.responseText);
      statusNode.textContent = response.error || "No se pudo completar la transferencia.";
    } catch {
      statusNode.textContent = "No se pudo completar la transferencia.";
    }
  });

  xhr.addEventListener("error", () => {
    statusNode.textContent = "Error de red. Verifica que el celular este en la misma WiFi.";
  });

  xhr.send(formData);
});

socket.on("disconnect", () => {
  presenceNode.textContent = "Conexion en tiempo real perdida. Reintentando...";
});
