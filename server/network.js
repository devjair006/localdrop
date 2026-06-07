const os = require("os");
const net = require("net");

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return "127.0.0.1";
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
