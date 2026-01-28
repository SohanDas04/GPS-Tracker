// 🔑 MapTiler API Key
const MAPTILER_KEY = "aTKpPp8VHRvaKuMqVakT";

// Backend URL
const BACKEND_URL = "http://127.0.0.1:5000";

let map;
let routeLayers = [];
let routeSources = [];
let startMarker, endMarker;
let activeRouteId = null;

// ---------------- INITIALIZE MAP ----------------
document.addEventListener("DOMContentLoaded", () => {
  map = new maplibregl.Map({
    container: "map",
    style: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`,
    center: [88.3639, 22.5726], // Kolkata
    zoom: 11,
  });

  map.addControl(new maplibregl.NavigationControl());

  // ---------------- SWAP BUTTON ----------------
  document.getElementById("swap").addEventListener("click", () => {
    let startInput = document.getElementById("start");
    let endInput = document.getElementById("end");
    let a = startInput.value;
    let b = endInput.value;
    startInput.value = b;
    endInput.value = a;
  });

  // ---------------- FIND ROUTES BUTTON ----------------
  document.getElementById("findRoutes").addEventListener("click", async () => {
    let startInput = document.getElementById("start");
    let endInput = document.getElementById("end");
    let startPlace = startInput.value.trim();
    let endPlace = endInput.value.trim();

    if (!startPlace || !endPlace) {
      alert("Please enter both starting point and destination");
      return;
    }

    try {
      // Show loading state
      let routesDiv = document.querySelector(".routes");
      routesDiv.innerHTML = "<h3>Finding Routes...</h3><p>Please wait...</p>";

      // Step 1: Geocode both places
      let startCoords = await geocode(startPlace);
      let endCoords = await geocode(endPlace);

      if (!startCoords || !endCoords) {
        alert("Location not found");
        routesDiv.innerHTML = "<h3>Available Routes</h3>";
        return;
      }

      // Show markers
      showMarkers(startCoords, endCoords);

      // Step 2: Get routes from backend
      await getRoutes(startCoords, endCoords);
    } catch (error) {
      console.error("Error finding routes:", error);
      alert("An error occurred while finding routes. Please try again.");
      let routesDiv = document.querySelector(".routes");
      routesDiv.innerHTML = "<h3>Available Routes</h3>";
    }
  });
});

// ---------------- GEOCODING FROM BACKEND ----------------
async function geocode(place) {
  try {
    let url = `${BACKEND_URL}/geocode?place=${encodeURIComponent(place)}`;

    let response = await fetch(url);
    let data = await response.json();

    if (data.error) {
      console.error("Geocoding error:", data.error);
      return null;
    }

    return [data.longitude, data.latitude]; // [lng, lat]
  } catch (error) {
    console.error("Geocoding fetch error:", error);
    return null;
  }
}

// ---------------- SHOW MARKERS ----------------
function showMarkers(start, end) {
  if (startMarker) startMarker.remove();
  if (endMarker) endMarker.remove();

  startMarker = new maplibregl.Marker({ color: "green" })
    .setLngLat(start)
    .addTo(map);

  endMarker = new maplibregl.Marker({ color: "red" }).setLngLat(end).addTo(map);

  map.fitBounds([start, end], { padding: 80 });
}

// ---------------- GET MULTIPLE ROUTES ----------------
async function getRoutes(start, end) {
  try {
    // Remove old routes
    routeLayers.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    routeSources.forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
    routeLayers = [];
    routeSources = [];
    activeRouteId = null;

    // Clear route cards
    let routesDiv = document.querySelector(".routes");
    routesDiv.innerHTML = "<h3>Available Routes</h3>";

    let url = `${BACKEND_URL}/route?start_lat=${start[1]}&start_lng=${start[0]}&end_lat=${end[1]}&end_lng=${end[0]}`;

    let response = await fetch(url);
    let data = await response.json();

    if (data.error) {
      alert("No routes found");
      return;
    }

    let routes = data.routes;

    if (routes.length === 0) {
      routesDiv.innerHTML = "<h3>Available Routes</h3><p>No routes found</p>";
      return;
    }

    // Add all routes to map (hidden initially except the best one)
    routes.forEach((route, index) => {
      let id = "route" + index;

      // Different colors for different routes
      let color =
        index === 0
          ? "#4caf50"
          : index === 1
            ? "#ff9800"
            : index === 2
              ? "#2196f3"
              : "#9e9e9e";

      map.addSource(id, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: route.geometry,
        },
      });

      map.addLayer({
        id: id,
        type: "line",
        source: id,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": color,
          "line-width": index === 0 ? 6 : 0, // Show only best route initially
          "line-opacity": index === 0 ? 1 : 0.7,
        },
      });

      routeLayers.push(id);
      routeSources.push(id);

      // Add route card on left
      addRouteCard(route, index, id, color);
    });

    // Set the best route as active
    activeRouteId = "route0";
  } catch (error) {
    console.error("Error getting routes:", error);
    alert("An error occurred while fetching routes. Please try again.");
  }
}

// ---------------- ROUTE CARDS ----------------
function addRouteCard(route, index, layerId, color) {
  let routesDiv = document.querySelector(".routes");

  let card = document.createElement("div");
  card.className = "route-card" + (index === 0 ? " best active" : "");
  card.setAttribute("data-route-id", layerId);

  // Determine rank badge
  let rankBadge = "";
  if (index === 0) {
    rankBadge = `<span class="rank-badge best-badge">RECOMMENDED</span>`;
  } else {
    rankBadge = `<span class="rank-badge">Route ${index + 1}</span>`;
  }

  // Traffic level based on duration (simulated)
  let trafficLevel = getTrafficLevel(route.duration_min, route.distance_km);
  let trafficColor =
    trafficLevel === "Low"
      ? "#4caf50"
      : trafficLevel === "Moderate"
        ? "#ff9800"
        : "#f44336";

  card.innerHTML = `
    <div class="route-header">
      ${rankBadge}
      <div class="route-color-indicator" style="background-color: ${color}"></div>
    </div>
    <div class="route-details">
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${route.duration_min} mins</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Distance:</span>
        <span class="detail-value">${route.distance_km} km</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Traffic:</span>
        <span class="detail-value" style="color: ${trafficColor}; font-weight: bold;">${trafficLevel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Avg Speed:</span>
        <span class="detail-value">${route.avg_speed} km/h</span>
      </div>
    </div>
    ${index === 0 ? '<div class="best-route-reason">✓ Fastest route with best traffic conditions</div>' : ""}
  `;

  // Click card → show that route exclusively
  card.addEventListener("click", () => {
    // Remove active class from all cards
    document
      .querySelectorAll(".route-card")
      .forEach((c) => c.classList.remove("active"));

    // Add active class to clicked card
    card.classList.add("active");

    // Hide all routes
    routeLayers.forEach((id) => {
      if (map.getLayer(id)) {
        map.setPaintProperty(id, "line-width", 0);
      }
    });

    // Show only the selected route with thicker line
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "line-width", 6);
      activeRouteId = layerId;
    }
  });

  routesDiv.appendChild(card);
}

// ---------------- CALCULATE TRAFFIC LEVEL ----------------
function getTrafficLevel(duration, distance) {
  // Calculate average speed
  let avgSpeed = (distance / (duration / 60)).toFixed(1);

  // Traffic estimation based on speed
  if (avgSpeed > 50) return "Low";
  if (avgSpeed > 30) return "Moderate";
  return "Heavy";
}