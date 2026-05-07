const API = "http://localhost:8080";

// ================= CHECK AUTH =================
function checkAuth() {
  const token = localStorage.getItem("token");
  console.log("CHECK TOKEN:", token);

  // nếu chưa login → về login
  // if (!token) {
  //   window.location.href = "login.html";
  // }
}

// ================= REGISTER =================
function register() {
  const user = {
    username: document.getElementById("name").value,
    email: document.getElementById("email").value,
    password: document.getElementById("password").value,
    weight: document.getElementById("weight").value
  };

  fetch(API + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  })
    .then(res => res.json())
    .then(() => {
      alert("Đăng ký thành công");
      window.location.href = "login.html";
    })
    .catch(() => alert("Lỗi đăng ký"));
}

// ================= LOGIN =================
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  fetch(API + "/api/auth/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ email, password })
  })
  .then(res => {
    if (!res.ok) throw new Error("Login fail");
    return res.json(); // 👈 đúng vì BE trả JSON
  })
  .then(data => {
    console.log("DATA:", data); // 👈 phải ra {token: "..."}
    console.log("TOKEN:", data.token);

    localStorage.setItem("token", data.token); // 🔥 QUAN TRỌNG

    console.log("SAVED:", localStorage.getItem("token"));

    window.location.href = "index.html";
  })
  .catch(err => {
    console.error(err);
    alert("Sai tài khoản hoặc mật khẩu");
  });
}

// ================= LOGOUT =================
function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// ================= DASHBOARD =================
function loadDashboard() {
  checkAuth();

  loadHistory();
}

// ================= LOAD HISTORY FROM DB =================
function loadHistory() {
  fetch(API + "/api/runs", {
    headers: {
      "Authorization": "Bearer " + localStorage.getItem("token")
    }
  })
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById("history");
      if (!list) return;

      list.innerHTML = "";

      data.forEach(run => {
        const li = document.createElement("li");
        li.innerText = `${run.distance.toFixed(2)} km - ${run.calories.toFixed(1)} cal`;

        list.appendChild(li);
      });
    })
    // .catch(() => alert("Không load được lịch sử"));
    .catch(err => {
      console.error(err);

      // nếu token sai → logout
      localStorage.removeItem("token");
      window.location.href = "login.html";
    });
}

// ================= NAV =================
function goRun() {
  checkAuth();
  window.location.href = "run.html";
}

function goBack() {
  window.location.href = "index.html";
}

// ================= EXPORT =================
function exportExcel() {
  const token = localStorage.getItem("token");

  fetch(API + "/api/export/excel", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => res.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "runs.xlsx";
    a.click();
  });
}

function exportWord() {
  const token = localStorage.getItem("token");

  fetch(API + "/api/export/word", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => res.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "runs.docx";
    a.click();
  });
}

// ================= RUN TRACKING =================
let map;
let path = [];
let polyline;
let watchId;

let totalDistance = 0;
let startTime;
let elapsedTime = 0;
let timer;
let isPaused = false;

let userMarker;

const weight = 60;

// init map
function initMap(lat, lng) {
  map = L.map('map').setView([lat, lng], 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    .addTo(map);

  polyline = L.polyline([], { color: 'red' }).addTo(map);
}

// start run
function startRun() {
  if (!navigator.geolocation) return alert("Không có GPS");

  totalDistance = 0;
  path = [];
  startTime = Date.now();
  elapsedTime = 0;
  isPaused = false;

  timer = setInterval(updateTime, 1000);

  watchId = navigator.geolocation.watchPosition(updatePosition);
}

// pause
function pauseRun() {
  isPaused = !isPaused;
}

// stop + SAVE DB
function stopRun() {
  navigator.geolocation.clearWatch(watchId);
  clearInterval(timer);

  const km = totalDistance / 1000;
  const calories = km * weight * 1.036;

  const data = {
    distance: km,
    time: elapsedTime,
    calories: calories,
    route: JSON.stringify(path)
  };

  fetch(API + "/api/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify(data)
  })
    .then(() => {
      alert("Đã lưu lịch sử chạy");
      goBack();
    })
    .catch(() => alert("Lỗi lưu DB"));
}

// time
function updateTime() {
  if (!isPaused) {
    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById("time").innerText = elapsedTime + " s";
  }
}

// GPS update
function updatePosition(pos) {
  if (isPaused) return;

  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  if (!map) {
    initMap(lat, lng);
  }

  const newPoint = [lat, lng];

  if (!userMarker) {
    userMarker = L.circleMarker(newPoint, {
      radius: 8,
      color: '#fff',
      fillColor: '#007bff',
      fillOpacity: 1
    }).addTo(map);
  } else {
    userMarker.setLatLng(newPoint);
  }

  map.setView(newPoint, 17);

  path.push(newPoint);
  polyline.setLatLngs(path);

  if (path.length > 1) {
    totalDistance += calculateDistance(
      path[path.length - 2],
      path[path.length - 1]
    );
  }

  updateStats();
}

// stats
function updateStats() {
  const km = totalDistance / 1000;

  document.getElementById("distance").innerText = km.toFixed(2) + " km";

  const calories = km * weight * 1.036;
  document.getElementById("calories").innerText = calories.toFixed(1);
}

// distance
function calculateDistance(p1, p2) {
  const R = 6371e3;
  const lat1 = p1[0] * Math.PI / 180;
  const lat2 = p2[0] * Math.PI / 180;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLng = (p2[1] - p1[1]) * Math.PI / 180;

  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// center map
function centerMap() {
  if (userMarker) {
    map.setView(userMarker.getLatLng(), 17);
  }
}

function deleteRun(id) {
  fetch(API + "/api/runs/" + id, {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + localStorage.getItem("token")
    }
  })
  .then(res => res.text())
  .then(msg => {
    alert(msg);
    loadHistory(); // reload list
  })
  .catch(() => alert("Lỗi xóa"));
}

function goProfile() {
  window.location.href = "profile.html";
}

function loadProfile() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  fetch(API + "/api/auth/me", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => res.json())
  .then(user => {
    document.getElementById("username").innerText = user.username;
    document.getElementById("email").innerText = user.email;
    document.getElementById("weight").innerText = user.weight;

    const avatar = document.getElementById("avatar");

    // 👇 FIX ẢNH
    if (!user.image) {
      avatar.src = "https://i.pravatar.cc/120";
    } 
    else if (user.image.startsWith("http")) {
      // 👉 ảnh URL ngoài
      avatar.src = user.image;
    } 
    else {
      // 👉 ảnh upload từ server
      avatar.src = API  + user.image;
    }

    // fill form edit
    document.getElementById("editName").value = user.username;
    document.getElementById("editWeight").value = user.weight;
    document.getElementById("editImage").value = user.image || "";
  })
  .catch(() => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
}

function showEdit() {
  document.getElementById("editForm").style.display = "block";
}

//upload profile
async function updateProfile() {
  const token = localStorage.getItem("token");

  console.log("TOKEN:", token); // 👈 check có token chưa

  const username = document.getElementById("editName").value;
  const weight = document.getElementById("editWeight").value;
  const imageUrl = document.getElementById("editImage").value;
  const file = document.getElementById("avatarFile").files[0];

  let finalImage = imageUrl;

  try {
    // ===== 1. UPLOAD FILE =====
    if (file) {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8080/api/auth/upload-avatar", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token
        },
        body: formData
      });

      console.log("UPLOAD STATUS:", res.status); // 👈 QUAN TRỌNG

      const text = await res.text(); // 👈 đọc raw response
      console.log("UPLOAD RESPONSE:", text);

      if (!res.ok) {
        throw new Error("Upload lỗi: " + text);
      }

      const data = JSON.parse(text);

      console.log("UPLOAD OK:", data);

      finalImage = data.image;

      document.getElementById("avatar").src =
        "http://localhost:8080/uploads/" + data.image;
    }

    // ===== 2. UPDATE PROFILE =====
    const res2 = await fetch("http://localhost:8080/api/auth/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        username: username,
        weight: weight,
        image: finalImage
      })
    });

    console.log("UPDATE STATUS:", res2.status);

    const text2 = await res2.text();
    console.log("UPDATE RESPONSE:", text2);

    if (!res2.ok) {
      throw new Error("Update lỗi: " + text2);
    }

    const user = JSON.parse(text2);

    alert("Cập nhật thành công");

    document.getElementById("username").innerText = user.username;
    document.getElementById("weight").innerText = user.weight;

  } catch (err) {
    console.error("FULL ERROR:", err);
    alert(err.message);
  }
}

function loadUserInfo() {
  const token = localStorage.getItem("token");

  fetch("http://localhost:8080/api/auth/me", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => res.json())
  .then(user => {

    // email
    document.getElementById("userEmail").innerText = user.email;

    // 👇 avatar (logic bạn cần)
    document.getElementById("avatar").src =
      user.image && user.image.trim() !== ""
        ? user.image
        : "https://i.pravatar.cc/120";

  })
  .catch(() => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
}

function changePassword() {
  const oldPassword = document.getElementById("oldPass").value;
  const newPassword = document.getElementById("newPass").value;

  fetch("http://localhost:8080/api/auth/change-password", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ oldPassword, newPassword })
  })
  .then(res => {
    if (!res.ok) throw new Error("Đổi mật khẩu thất bại");
    return res.json();
  })
  .then(data => {
    alert(data.message);
  })
  .catch(err => {
    alert(err.message);
  });
}

// auto load map
window.addEventListener("load", () => {
  if (document.getElementById("map")) {
    navigator.geolocation.getCurrentPosition(pos => {
      initMap(pos.coords.latitude, pos.coords.longitude);
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("avatarFile");

  if (fileInput) {
    fileInput.addEventListener("change", function () {
      const file = this.files[0];

      if (file) {
        const reader = new FileReader();

        reader.onload = function (e) {
          const preview = document.getElementById("preview");
          preview.src = e.target.result;
          preview.style.display = "block";
        };

        reader.readAsDataURL(file);
      }
    });
  }
});