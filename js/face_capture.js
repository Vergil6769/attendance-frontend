const backend = "https://attendance-backend-pa84.onrender.com";

const video = document.getElementById("video");
let usernameGlobal = "";

document.getElementById("loginBtn").onclick = async () => {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const res = await fetch(`${backend}/student_login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.status === "success") {
        alert("Login success");
        usernameGlobal = username;
        startVideo();
    } else {
        alert("Invalid credentials");
    }
};

async function startVideo() {
    document.getElementById("cameraDiv").style.display = "block";
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => { video.srcObject = stream; })
        .catch(err => console.error(err));
}

document.getElementById("verifyFaceBtn").onclick = async () => {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

    if (!detections) {
        alert("Face not detected");
        return;
    }

    const encoding = Array.from(detections.descriptor);

    const res = await fetch(`${backend}/verify_face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameGlobal, encoding })
    });

    const data = await res.json();
    if (data.match) alert("Face verified!");
    else alert("Face mismatch!");
};