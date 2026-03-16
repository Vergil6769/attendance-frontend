// ============================
// face_capture.js
// ============================

const BACKEND_URL = "https://attendance-backend-pa84.onrender.com";

let username = "";
let faceVerified = false;

// ---------------------------
// DOM ELEMENTS
// ---------------------------
const loginBtn = document.getElementById("login-btn");
const faceSection = document.getElementById("face-section");
const qrSection = document.getElementById("qr-section");

const camera = document.getElementById("camera");
const captureBtn = document.getElementById("capture-btn");
const timerDisplay = document.getElementById("timer");
const faceCanvas = document.getElementById("face-canvas");

const qrCamera = document.getElementById("qr-camera");

// ---------------------------
// LOAD FACE MODELS
// ---------------------------
async function loadModels() {
    const MODEL_URL = "https://vergil6769.github.io/attendance-frontend/models";
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log("Face models loaded");
}
loadModels();

// ---------------------------
// LOGIN
// ---------------------------
loginBtn.addEventListener("click", async () => {
    username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (!username || !password) {
        alert("Enter username and password");
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/student_login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.status === "success") {
            document.getElementById("login-section").style.display = "none";
            faceSection.style.display = "block";
            startCamera();
        } else {
            alert("Login failed");
        }
    } catch (err) {
        console.error(err);
        alert("Error connecting to backend");
    }
});

// ---------------------------
// START FRONT CAMERA
// ---------------------------
function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        .then(stream => {
            camera.srcObject = stream;
            camera.addEventListener('loadedmetadata', () => {
                camera.width = camera.videoWidth;
                camera.height = camera.videoHeight;
                camera.play();
            });
        })
        .catch(() => alert("Camera permission denied"));
}

// ---------------------------
// FACE VERIFICATION
// ---------------------------
captureBtn.addEventListener("click", async () => {
    if (camera.readyState !== camera.HAVE_ENOUGH_DATA) {
        alert("Camera not ready yet");
        return;
    }

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

    const detection = await faceapi
        .detectSingleFace(camera, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        alert("No face detected. Make sure your face is fully visible and well-lit.");
        return;
    }

    // Set canvas size
    faceCanvas.width = camera.videoWidth;
    faceCanvas.height = camera.videoHeight;

    // Draw detection box
    const displaySize = { width: faceCanvas.width, height: faceCanvas.height };
    faceapi.matchDimensions(faceCanvas, displaySize);
    const resized = faceapi.resizeResults(detection, displaySize);

    faceCanvas.getContext('2d').clearRect(0, 0, faceCanvas.width, faceCanvas.height);
    faceapi.draw.drawDetections(faceCanvas, resized);
    faceapi.draw.drawFaceLandmarks(faceCanvas, resized);

    const descriptor = Array.from(detection.descriptor);

    try {
        const res = await fetch(`${BACKEND_URL}/verify_face`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, encoding: descriptor })
        });
        const data = await res.json();

        if (data.match) {
            faceVerified = true;
            alert("Face verified!");
            startTimer(10, () => startQRScan()); // start QR scan after 10s timer
        } else {
            alert("Face verification failed. Try again.");
        }
    } catch (err) {
        console.error(err);
        alert("Error verifying face");
    }
});

// ---------------------------
// TIMER FUNCTION
// ---------------------------
function startTimer(seconds, callback) {
    let time = seconds;
    timerDisplay.innerText = "Timer: " + time + "s";

    const interval = setInterval(() => {
        time--;
        timerDisplay.innerText = "Timer: " + time + "s";

        if (time <= 0) {
            clearInterval(interval);
            if (callback) callback();
        }
    }, 1000);
}

// ---------------------------
// START BACK CAMERA FOR QR
// ---------------------------
function startQRScan() {
    faceSection.style.display = "none";
    qrSection.style.display = "block";

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            qrCamera.srcObject = stream;
            qrCamera.addEventListener('loadedmetadata', () => {
                qrCamera.width = qrCamera.videoWidth;
                qrCamera.height = qrCamera.videoHeight;
                qrCamera.play();
                scanQR();
            });
        })
        .catch(() => alert("Back camera permission denied"));
}

// ---------------------------
// QR SCAN FUNCTION
// ---------------------------
function scanQR() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    setInterval(() => {
        if (qrCamera.readyState !== qrCamera.HAVE_ENOUGH_DATA) return;

        canvas.width = qrCamera.videoWidth;
        canvas.height = qrCamera.videoHeight;

        ctx.drawImage(qrCamera, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code) {
            try {
                const qrData = JSON.parse(code.data);
                markAttendance(qrData.session, qrData.token);
            } catch {
                console.log("Invalid QR code");
            }
        }
    }, 500);
}

// ---------------------------
// MARK ATTENDANCE
// ---------------------------
async function markAttendance(session, token) {
    if (!faceVerified) {
        alert("Face verification expired");
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/mark_attendance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, session, token })
        });
        const data = await res.json();
        alert(data.status);
    } catch (err) {
        console.error(err);
        alert("Error marking attendance");
    }
}