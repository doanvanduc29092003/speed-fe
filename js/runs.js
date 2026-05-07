// ===== GLOBAL =====
let map;
let marker;

let liveWatchId; // luôn chạy (hiện vị trí)
let isRunning = false;

let path = [];
let polyline;

// distance + time
let totalDistance = 0;
let lastPosition = null;

let startTime = null;
let timerInterval = null;

// ===== INIT MAP =====
function initMap(lat, lng) {

  map = L.map('map').setView([lat, lng], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // 👇 icon người
  const userIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });

  marker = L.marker([lat, lng], { icon: userIcon }).addTo(map);

  // đường chạy
  polyline = L.polyline(path, { color: 'red' }).addTo(map);

  // 🔥 bật tracking ngay khi load
  startLiveTracking();
}

// ===== LIVE TRACKING (LUÔN CHẠY) =====
function startLiveTracking() {

  if (!navigator.geolocation) {
    alert("Không hỗ trợ GPS");
    return;
  }

  liveWatchId = navigator.geolocation.watchPosition(pos => {

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // 🟢 luôn update vị trí (chấm xanh)
    marker.setLatLng([lat, lng]);

    // 🔴 chỉ vẽ khi đang chạy
    if (isRunning) {

      // map follow
      map.setView([lat, lng]);

      // vẽ đường
      path.push([lat, lng]);
      polyline.setLatLngs(path);

      // ===== DISTANCE =====
      if (lastPosition) {
        const d = getDistance(
          lastPosition.lat,
          lastPosition.lng,
          lat,
          lng
        );

        totalDistance += d;

        document.getElementById("distance").innerText =
          (totalDistance / 1000).toFixed(2) + " km";
      }

      lastPosition = { lat, lng };

      // ===== CALORIES =====
      const calories = (totalDistance / 1000) * 60;
      document.getElementById("calories").innerText =
        calories.toFixed(0);
    }

  }, err => {
    console.log(err);
  }, {
    enableHighAccuracy: true
  });
}

// ===== START =====
function startRun() {

  if (isRunning) return;

  isRunning = true;

  // reset dữ liệu nếu muốn chạy mới
  path = [];
  polyline.setLatLngs(path);

  totalDistance = 0;
  lastPosition = null;

  document.getElementById("distance").innerText = "0.00 km";
  document.getElementById("calories").innerText = "0";

  startTime = Date.now();

  timerInterval = setInterval(updateTime, 1000);
}

// ===== PAUSE =====
function pauseRun() {
  isRunning = false;

  if (timerInterval) {
    clearInterval(timerInterval);
  }
}

// ===== STOP =====
function stopRun() {

  isRunning = false;

  if (timerInterval) {
    clearInterval(timerInterval);
  }

  alert("Đã dừng chạy");
}

// ===== CENTER MAP =====
function centerMap() {

  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(pos => {

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    map.setView([lat, lng], 16);

    if (marker) {
      marker.setLatLng([lat, lng]);
    }
  });
}

// ===== TIME =====
function updateTime() {
  const now = Date.now();
  const seconds = Math.floor((now - startTime) / 1000);

  document.getElementById("time").innerText = seconds + " s";
}

// ===== DISTANCE (HAVERSINE) =====
function getDistance(lat1, lon1, lat2, lon2) {

  const R = 6371000;

  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ===== BACK =====
function goBack() {
  window.location.href = "dashboard.html";
}