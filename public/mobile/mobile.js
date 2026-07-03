const form = document.getElementById("upload-form");
const pinInput = document.getElementById("pin");
const filesInput = document.getElementById("files");
const progressBar = document.getElementById("progress-bar");
const statusNode = document.getElementById("status");
const presenceNode = document.getElementById("presence");
let deviceName = "dispositivo movil";
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
});

socket.on("presence:ack", ({ deviceName }) => {
  deviceName = deviceName || "dispositivo movil";
  presenceNode.textContent = `${deviceName} vinculado con la app de escritorio.`;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

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
