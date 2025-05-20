const video    = document.getElementById('video');
const startBtn = document.getElementById('startBtn');
const stopBtn  = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const wrapper  = document.querySelector('.video-wrapper');

let canvas, isDetecting = false;

async function loadModels() {
  const MODEL_URL = './models';
  statusEl.textContent = 'Loading models...';
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
    ]);
    statusEl.textContent = 'Models loaded.';
    startBtn.disabled = false;
  } catch (e) {
    console.error('Model loading error:', e);
    statusEl.textContent = 'Error loading models.';
  }
}

async function startDetection() {
  startBtn.disabled = true;
  stopBtn.disabled  = false;
  statusEl.textContent = 'Accessing camera...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    console.error('Camera error:', err);
    statusEl.textContent = 'Error accessing camera.';
    startBtn.disabled = false;
    stopBtn.disabled  = true;
    return;
  }

  video.onloadedmetadata = () => {
    video.play();

    if (canvas) canvas.remove();
    canvas = faceapi.createCanvasFromMedia(video);
    wrapper.appendChild(canvas);

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    faceapi.matchDimensions(canvas, {
      width: video.videoWidth,
      height: video.videoHeight
    });

    isDetecting = true;
    statusEl.textContent = 'Detecting...';
    detectLoop();
  };
}

function stopDetection() {
  startBtn.disabled = false;
  stopBtn.disabled  = true;
  statusEl.textContent = 'Detection stopped.';
  isDetecting = false;
  if (canvas) canvas.remove();
  video.pause();
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
}

async function detectLoop() {
  if (!isDetecting) return;

  const detections = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceExpressions()
    .withAgeAndGender();

  const resized = faceapi.resizeResults(detections, {
    width: video.videoWidth,
    height: video.videoHeight
  });

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  faceapi.draw.drawDetections(canvas, resized);
  faceapi.draw.drawFaceLandmarks(canvas, resized);
  faceapi.draw.drawFaceExpressions(canvas, resized);

  resized.forEach(face => {
    const { age, gender, genderProbability } = face;
    const text = [
      `${gender} (${(genderProbability * 100).toFixed(0)}%)`,
      `Age: ${age.toFixed(0)}`
    ];
    new faceapi.draw.DrawTextField(
      text,
      face.detection.box.bottomRight
    ).draw(canvas);
  });

  requestAnimationFrame(detectLoop);
}

startBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopDetection);

loadModels();