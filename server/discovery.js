const os = require("os");
const { Bonjour } = require("bonjour-service");

function slugifyHostName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "desktop";
}

async function startDiscovery({ port, onStatusChange }) {
  const machineName = os.hostname();
  const hostLabel = `localdrop-${slugifyHostName(machineName)}`;
  const serviceName = `LocalDrop on ${machineName} (${port})`;
  const hostname = `${hostLabel}.local`;
  const hostnameUrl = `http://${hostname}:${port}/mobile/`;
  const state = {
    discoveryStatus: "unavailable",
    hostnameUrl,
    serviceName
  };

  let bonjour;
  let service;

  try {
    bonjour = new Bonjour();
    service = bonjour.publish({
      name: serviceName,
      type: "http",
      port,
      host: hostname,
      txt: {
        app: "localdrop",
        version: "1",
        path: "/mobile/",
        port: String(port)
      }
    });

    state.discoveryStatus = "published";
    onStatusChange?.({ ...state });

    if (typeof service.on === "function") {
      service.on("error", () => {
        state.discoveryStatus = "error";
        onStatusChange?.({ ...state });
      });
    }
  } catch (_error) {
    state.discoveryStatus = "unavailable";
    onStatusChange?.({ ...state });
  }

  return {
    ...state,
    stop: () =>
      new Promise((resolve) => {
        const finish = () => {
          try {
            bonjour?.destroy();
          } catch (_error) {
            // Ignore cleanup failures on shutdown.
          }

          resolve();
        };

        if (service?.stop) {
          service.stop(() => finish());
          return;
        }

        finish();
      })
  };
}

module.exports = {
  startDiscovery
};
