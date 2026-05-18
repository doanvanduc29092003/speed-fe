let isVoiceMode = false; // 🔥 phân biệt mic vs gõ
let currentSessionId = null;

function quickAsk(text) {
  document.getElementById("msg").value = text;
  isVoiceMode = false; // 👉 quick hỏi = text
  sendMessage();
}

function sendMessage() {
  const input = document.getElementById("msg");
  const text = input.value.trim();

  if (!text) return;

  addMessage("user", text);

  const token = localStorage.getItem("token");

  fetch("speed-be-production.up.railway.app/api/auth/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      message: text,
      sessionId: currentSessionId
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(data => {
      addMessage("bot", data.reply);

      if (data.sessionId) {
        currentSessionId = data.sessionId;
      }

      loadSessions(); // 🔥 reload sidebar
    })
    .catch(err => {
      console.error(err);
      addMessage("bot", "❌ Lỗi: " + err.message);
      isVoiceMode = false;
    });

  input.value = "";
}

function addMessage(type, text) {
  const div = document.createElement("div");
  div.className = type === "user" ? "msg-user" : "msg-bot";

  div.innerHTML = text.replace(/\n/g, "<br>");

  const chatBody = document.getElementById("chat-body");
  chatBody.appendChild(div);

  chatBody.scrollTop = chatBody.scrollHeight;

  // 🔥 CHỈ đọc khi dùng mic
  if (type === "bot" && isVoiceMode) {
    speak(text);
  }
}

// ================= VOICE =================

// 🎤 BẮT ĐẦU NÓI
function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Trình duyệt không hỗ trợ mic 😢");
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "vi-VN";

  // 🔥 bật voice mode
  isVoiceMode = true;

  recognition.start();

  recognition.onresult = function (event) {
    const text = event.results[0][0].transcript;

    document.getElementById("msg").value = text;
    sendMessage();
  };

  recognition.onerror = function (e) {
    console.log("Lỗi mic:", e);
    isVoiceMode = false;
  };
}

// 🔊 AI NÓI
function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);

  const voices = speechSynthesis.getVoices();

  let viVoice = voices.find(v => v.lang === "vi-VN");

  if (!viVoice) {
    viVoice = voices.find(v => v.lang.includes("vi"));
  }

  if (viVoice) {
    utter.voice = viVoice;
  } else {
    console.warn("⚠️ Không có voice tiếng Việt");
  }

  utter.lang = "vi-VN";
  utter.rate = 1;
  utter.pitch = 1;

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

// ================= UI =================

function toggleChat() {
  const chat = document.getElementById("chatbox");
  chat.classList.toggle("hidden");

  if (!chat.classList.contains("hidden")) {
    loadSessions(); // 🔥 load list khi mở
  }
}

document.addEventListener("click", function (event) {
  const chat = document.getElementById("chatbox");
  const icon = document.getElementById("chat-icon");

  if (!chat.contains(event.target) && !icon.contains(event.target)) {
    chat.classList.add("hidden");
  }
});

document.getElementById("msg").addEventListener("keypress", function (e) {
  if (e.key === "Enter") sendMessage();
});

function loadSessions() {
  const token = localStorage.getItem("token");

  fetch("speed-be-production.up.railway.app/api/auth/chat/sessions", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => res.json())
  .then(data => {
    const box = document.getElementById("chat-sessions");
    box.innerHTML = "";

    data.forEach(s => {
      const div = document.createElement("div");
      div.className = "session-item";

      div.innerHTML = `
        <div class="session-item-text">${s.title}</div>
        <span class="delete-btn"
              onclick="event.stopPropagation(); deleteSession(${s.id})">✖</span>
      `;

      div.onclick = () => loadHistory(s.id);

      box.appendChild(div);
    });
  });
}

function loadHistory(sessionId) {
  currentSessionId = sessionId;

  const token = localStorage.getItem("token");

  fetch(`speed-be-production.up.railway.app/api/auth/chat/history/${sessionId}`, {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
    .then(res => res.json())
    .then(data => {
      const chatBody = document.getElementById("chat-body");
      chatBody.innerHTML = "";

      data.forEach(msg => {
        addMessage(msg.role === "user" ? "user" : "bot", msg.content);
      });
    });
}

function newChat() {
  currentSessionId = null;
  document.getElementById("chat-body").innerHTML = "";
}

function deleteSession(id) {
  const token = localStorage.getItem("token");

  fetch(`speed-be-production.up.railway.app/api/auth/chat/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => {
    if (!res.ok) throw new Error("Xoá thất bại");

    loadSessions();

    if (currentSessionId === id) {
      newChat();
    }
  })
  .catch(err => console.error("❌ Lỗi xoá:", err));
}