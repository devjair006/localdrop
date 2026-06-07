const form = document.getElementById("upload-form");
const pinInput = document.getElementById("pin");
const filesInput = document.getElementById("files");
const progressBar = document.getElementById("progress-bar");
const statusNode = document.getElementById("status");

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

  xhr.upload.addEventListener("progress", (progressEvent) => {
    if (!progressEvent.lengthComputable) {
      return;
    }

    const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
    progressBar.style.width = `${percent}%`;
    statusNode.textContent = `Subiendo... ${percent}%`;
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
