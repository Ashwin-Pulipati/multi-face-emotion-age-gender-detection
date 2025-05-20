const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const wrapper = document.querySelector(".video-wrapper");
const themeToggle = document.getElementById("themeToggle");
const yearEl = document.getElementById("year");

let canvas = null;
let isDetecting = false;

yearEl.textContent = new Date().getFullYear();

async function loadModels() {
  const MODEL_URL = "./models";
  statusEl.innerHTML = `
  <div style="
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    justify-content: center;
  ">
    <span>Loading models</span>
    <l-metronome size="20" speed="1.6" color="#ff0000"></l-metronome>
  </div>
`;


  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
    ]);
    statusEl.textContent = "Models loaded.";
    startBtn.disabled = false;
  } catch (error) {
    console.error("Model loading error:", error);
    statusEl.textContent = "Error loading models.";
  }
}

async function startDetection() {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusEl.textContent = "Accessing camera...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (error) {
    console.error("Camera access error:", error);
    statusEl.textContent = "Error accessing camera.";
    startBtn.disabled = false;
    stopBtn.disabled = true;
    return;
  }

  video.onloadedmetadata = () => {
    video.play();

    if (canvas) {
      canvas.remove();
      canvas = null;
    }
    canvas = faceapi.createCanvasFromMedia(video);
    wrapper.appendChild(canvas);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    faceapi.matchDimensions(canvas, {
      width: video.videoWidth,
      height: video.videoHeight,
    });

    isDetecting = true;
    statusEl.textContent = "Detecting...";
    detectLoop();
  };
}

function stopDetection() {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = "Detection stopped.";
  isDetecting = false;

  if (canvas) {
    canvas.remove();
    canvas = null;
  }

  video.pause();

  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }
}

async function detectLoop() {
  if (!isDetecting) return;

  try {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender();

    const resizedDetections = faceapi.resizeResults(detections, {
      width: video.videoWidth,
      height: video.videoHeight,
    });

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    resizedDetections.forEach((detection) => {
      const { age, gender, genderProbability } = detection;
      const text = [
        `${gender} (${(genderProbability * 100).toFixed(0)}%)`,
        `Age: ${age.toFixed(0)}`,
      ];
      new faceapi.draw.DrawTextField(
        text,
        detection.detection.box.bottomRight
      ).draw(canvas);
    });
  } catch (err) {
    console.error("Detection error:", err);
  }

  requestAnimationFrame(detectLoop);
}

function setTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.textContent = "☀️";
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeToggle.textContent = "🌙";
  }
  localStorage.setItem("theme", theme);
}

const savedTheme = localStorage.getItem("theme") || "light";
setTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  if (currentTheme === "dark") {
    setTheme("light");
  } else {
    setTheme("dark");
  }
});

startBtn.addEventListener("click", startDetection);
stopBtn.addEventListener("click", stopDetection);

loadModels();
