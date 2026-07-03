const os = require("os");
const net = require("net");

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  let fallbackIp = "127.0.0.1";

  for (const [name, entries] of Object.entries(interfaces)) {
    // llamaba por defecto a la ip de mi maquina virtual
    const isVirtualName = name.toLowerCase().includes("vethernet") ||
                          name.toLowerCase().includes("virtual") ||
                          name.toLowerCase().includes("vmware") ||
                          name.toLowerCase().includes("wsl");

    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        const macPrefix = entry.mac.substring(0, 8).toLowerCase();
        const isVirtualMac = macPrefix === "00:15:5d" || // Hyper-V
                             macPrefix === "08:00:27" || // VirtualBox
                             macPrefix === "0a:00:27" || // VirtualBox
                             macPrefix === "00:50:56" || // VMware
                             macPrefix === "00:0c:29" || // VMware
                             macPrefix === "00:05:69";   // VMware

        if (!isVirtualName && !isVirtualMac) {
          // Si no es virtual, preferimos este (Ej. "Wi-Fi" o "Ethernet")
          return entry.address;
        } else if (fallbackIp === "127.0.0.1") {
          // Guardamos el virtual como fallback por si no hay otro
          fallbackIp = entry.address;
        }
      }
    }
  }

  return fallbackIp;
}

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(findAvailablePort(startPort + 1));
        return;
      }

      reject(error);
    });

    server.listen(startPort, "0.0.0.0", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

module.exports = {
  findAvailablePort,
  getLocalIpAddress
};
