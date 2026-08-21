"use strict";

const spinnerEl = document.getElementById("spinner");
const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");
const errorBox = document.getElementById("errorBox");
const errorTitle = document.getElementById("errorTitle");
const errorBody = document.getElementById("errorBody");
const dockerBtn = document.getElementById("dockerBtn");
const retryBtn = document.getElementById("retryBtn");
const logToggle = document.getElementById("logToggle");
const logEl = document.getElementById("log");

let logLines = [];

function showError(title, body, { showDockerLink = false } = {}) {
  spinnerEl.style.display = "none";
  statusEl.textContent = "";
  hintEl.textContent = "";
  errorBox.classList.add("visible");
  errorTitle.textContent = title;
  errorBody.textContent = body;
  dockerBtn.style.display = showDockerLink ? "inline-block" : "none";
}

function resetToLoading() {
  spinnerEl.style.display = "block";
  errorBox.classList.remove("visible");
  logLines = [];
  logEl.textContent = "";
  logEl.classList.remove("visible");
  logToggle.textContent = "Günlüğü göster";
}

window.velyo.onStartupStatus(({ status, detail }) => {
  switch (status) {
    case "detecting-docker":
      statusEl.textContent = "Docker aranıyor…";
      break;
    case "docker-not-found":
      showError(
        "Docker Desktop bulunamadı",
        "Velyo, servisleri (veritabanı, PDF işleme, arayüz) yerel olarak çalıştırmak için Docker Desktop kullanır. " +
          "Lütfen Docker Desktop'ı kurup açık olduğundan emin olduktan sonra tekrar deneyin.",
        { showDockerLink: true }
      );
      break;
    case "starting-containers":
      statusEl.textContent = "Servisler başlatılıyor…";
      hintEl.textContent = "İlk kurulumda birkaç dakika sürebilir (imajlar oluşturuluyor).";
      break;
    case "log":
      logLines.push(detail);
      if (logLines.length > 500) logLines = logLines.slice(-500);
      logEl.textContent = logLines.join("");
      logEl.scrollTop = logEl.scrollHeight;
      break;
    case "docker-daemon-not-running":
      showError(
        "Docker Desktop çalışmıyor",
        "Docker kurulu ama Docker Desktop şu anda açık değil gibi görünüyor. " +
          "Lütfen Docker Desktop'ı başlatın (simge sistem tepsisinde/menü çubuğunda görünene kadar bekleyin) ve ardından tekrar deneyin."
      );
      break;
    case "compose-failed":
      showError(
        "Servisler başlatılamadı",
        "docker compose up sırasında bir hata oluştu: " +
          (detail || "bilinmeyen hata") +
          "\n\nDetaylar için günlüğü kontrol edin."
      );
      break;
    case "waiting-for-health":
      statusEl.textContent = "Servislerin hazır olması bekleniyor…";
      break;
    case "health-timeout":
      showError(
        "Servisler zamanında yanıt vermedi",
        "Konteynerler başlatıldı ama backend/frontend belirlenen sürede hazır olmadı. " +
          "Docker Desktop'ta konteynerlerin durumunu kontrol edin ve tekrar deneyin."
      );
      break;
    case "ready":
      statusEl.textContent = "Hazır, açılıyor…";
      break;
  }
});

retryBtn.addEventListener("click", () => {
  resetToLoading();
  window.velyo.retryStartup();
});

dockerBtn.addEventListener("click", () => {
  window.velyo.openExternal("https://www.docker.com/products/docker-desktop/");
});

logToggle.addEventListener("click", () => {
  const visible = logEl.classList.toggle("visible");
  logToggle.textContent = visible ? "Günlüğü gizle" : "Günlüğü göster";
});
