// Replace with your deployed backend URL
const BACKEND_URL = "https://attendance-backend-pa84.onrender.com";
const FACE_MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

let faceModelsReady = false;
let faceCameraStream = null;

async function ensureFaceModelsLoaded() {

    if (faceModelsReady) {
        return faceModelsReady;
    }

    if (typeof faceapi === "undefined") {
        setFaceStatus("Face verification library could not be loaded.", true);
        return false;
    }

    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL)
        ]);

        faceModelsReady = true;
        setFaceStatus("Face verification is ready. Open the camera and continue.");
    } catch (error) {
        console.log(error);
        setFaceStatus("Could not load face verification models. Check your internet connection and refresh.");
    }

    return faceModelsReady;
}

function setFaceStatus(message, isError = false) {
    const status = document.getElementById("face_status");

    if (!status) {
        return;
    }

    status.innerText = message;
    status.classList.toggle("error-text", isError);
}

async function startFaceCamera() {

    const video = document.getElementById("face_video");

    if (!video) {
        return;
    }

    if (!await ensureFaceModelsLoaded()) {
        setFaceStatus("Face verification is not ready yet.", true);
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFaceStatus("This browser does not support camera access.", true);
        return;
    }

    try {
        if (!faceCameraStream) {
            faceCameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
        }

        video.srcObject = faceCameraStream;
        await video.play();
        setFaceStatus("Camera is active. Keep your face centered and well-lit.");
    } catch (error) {
        console.log(error);
        setFaceStatus("Camera access was blocked. Allow camera permission and try again.", true);
    }
}

async function captureFaceDescriptor() {

    const video = document.getElementById("face_video");

    if (!video || !faceCameraStream) {
        setFaceStatus("Open the camera before starting face verification.", true);
        return null;
    }

    if (!await ensureFaceModelsLoaded()) {
        setFaceStatus("Face verification models are still unavailable.", true);
        return null;
    }

    const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        setFaceStatus("No clear face detected. Face the camera directly and try again.", true);
        return null;
    }

    return Array.from(detection.descriptor);
}

async function loginStudent() {

    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();

    if (!username || !password) {
        alert("Enter your student ID and password");
        return null;
    }

    const response = await fetch(`${BACKEND_URL}/student_login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok || data.status !== "success") {
        alert(data.message || "Invalid Student ID or Password");
        return null;
    }

    return data;
}

async function enrollStudentFace() {

    try {
        const student = await loginStudent();

        if (!student) {
            return;
        }

        const descriptor = await captureFaceDescriptor();

        if (!descriptor) {
            return;
        }

        setFaceStatus("Saving face enrollment...");

        const response = await fetch(`${BACKEND_URL}/enroll_face`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: student.username,
                descriptor: descriptor
            })
        });

        const result = await response.json();

        if (result.status === "enrolled") {
            setFaceStatus("Face enrolled successfully. You can now verify attendance.");
            alert("Face enrolled successfully");
        } else {
            setFaceStatus(result.message || "Face enrollment failed.", true);
            alert(result.message || "Face enrollment failed");
        }
    } catch (error) {
        console.log(error);
        setFaceStatus("Server error during face enrollment.", true);
        alert("Server error");
    }
}

// ===========================
// STUDENT LOGIN + MARK ATTENDANCE
// ===========================
async function verifyStudent() {

    try {
        const student = await loginStudent();

        if (!student) {
            return;
        }

        const descriptor = await captureFaceDescriptor();

        if (!descriptor) {
            return;
        }

        let params = new URLSearchParams(window.location.search);
        let session = params.get("session");
        let token = params.get("token");

        if (!token || !session) {
            alert("Invalid QR Code");
            return;
        }

        setFaceStatus("Comparing your live face with the enrolled record...");

        const faceResponse = await fetch(`${BACKEND_URL}/verify_face`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: student.username,
                descriptor: descriptor
            })
        });

        const faceResult = await faceResponse.json();

        if (faceResult.status === "face_not_enrolled") {
            setFaceStatus("No enrolled face found. Enroll first, then verify attendance.", true);
            alert("No face enrolled for this student. Use Enroll Face first.");
            return;
        }

        if (faceResult.status !== "matched") {
            setFaceStatus("Face verification failed. Use the same student and try again.", true);
            alert("Face verification failed");
            return;
        }

        setFaceStatus("Face verified. Marking attendance...");

        const attendanceResponse = await fetch(`${BACKEND_URL}/mark_attendance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: student.name,
                roll: student.roll,
                division: student.division,
                session: session,
                token: token
            })
        });

        const result = await attendanceResponse.json();

        if (result.status === "present") {
            setFaceStatus("Attendance marked successfully.");
            alert("Attendance Marked Successfully");
        } else if (result.status === "already_marked") {
            alert("Attendance Already Marked");
        } else if (result.status === "qr_expired") {
            alert("QR Code Expired. Please scan again.");
        } else if (result.status === "invalid_qr") {
            alert("Invalid QR Code. Please scan again.");
        } else if (result.status === "invalid_session") {
            alert("Attendance session is no longer active. Please scan a fresh QR code.");
        } else if (result.status === "wrong_division") {
            alert("This QR session is for a different division.");
        } else {
            alert(result.message || "Error marking attendance");
        }
    } catch (error) {
        console.log(error);
        setFaceStatus("Server error during verification.", true);
        alert("Server error");
    }
}

// ===========================
// TEACHER LOGIN
// ===========================
function teacherLogin() {

    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();

    if (!username || !password) {
        alert("Enter username and password");
        return;
    }

    fetch(`${BACKEND_URL}/teacher_login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            localStorage.setItem("teacher", username);
            window.location = "teacher_dashboard.html";
        } else {
            alert(data.message || "Invalid Username or Password");
        }
    })
    .catch(err => {
        console.log(err);
        alert("Server error");
    });
}

// ===========================
// START ATTENDANCE SESSION
// ===========================
function startAttendance() {

    let division = document.getElementById("division").value;
    let lecture = document.getElementById("lecture").value;
    let teacher = localStorage.getItem("teacher");

    if (!teacher) {
        alert("Teacher not logged in");
        window.location = "index.html";
        return;
    }

    fetch(`${BACKEND_URL}/start_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ division, lecture, teacher })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "session_started") {
            if (window.qrInterval) {
                clearInterval(window.qrInterval);
            }

            document.getElementById("lecture_name").innerText =
                "Subject: " + data.subject;

            // Load first QR immediately
            loadQR();

            // Refresh QR every  seconds
            window.qrInterval = setInterval(loadQR, 7000);

        } else if (data.status === "no_lecture_today") {
            alert("No lecture scheduled today");
        } else if (data.status === "timetable_missing") {
            alert("Timetable not found for division " + division);
        } else if (data.status === "invalid_lecture") {
            alert("Invalid lecture number");
        } else if (data.status === "invalid_division") {
            alert("Invalid division");
        } else {
            alert(data.message || "Could not start attendance session");
        }
    })
    .catch(err => {
        console.log(err);
        alert("Server connection error");
    });
}

// ===========================
// LOAD QR (ROTATES EVERY 10 SEC)
// ===========================
function loadQR() {

    let qr = document.getElementById("qr");

    if (qr) {
        // Use Date.now() to prevent caching and force reload
        qr.src = `${BACKEND_URL}/generate_qr?t=${Date.now()}`;
    }
}

// ===========================
// STOP ATTENDANCE
// ===========================
function stopAttendance() {

    fetch(`${BACKEND_URL}/stop_session`, { method: "POST" })
    .catch(err => console.log(err));

    document.getElementById("qr").src = "";
    document.getElementById("lecture_name").innerText = "";

    if (window.qrInterval) {
        clearInterval(window.qrInterval);
    }
}

// ===========================
// LOAD ATTENDANCE
// ===========================
function loadAttendance() {

    let division = document.getElementById("division_view").value;

    fetch(`${BACKEND_URL}/attendance_by_division?division=${division}`)
    .then(res => res.json())
    .then(data => {

        let table = document.getElementById("attendance_table");
        table.innerHTML = "";

        data.forEach(row => {
            let tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${row.Name || ""}</td>
                <td>${row.Roll || ""}</td>
                <td>${row.Subject || ""}</td>
                <td>${row.Lecture || ""}</td>
                <td>${row.Date || ""}</td>
                <td>${row.Time || ""}</td>
            `;

            table.appendChild(tr);
        });
    })
    .catch(err => {
        console.log(err);
        alert("Could not load attendance");
    });
}

// ===========================
// LOGOUT
// ===========================
function logout() {
    localStorage.removeItem("teacher");
    window.location = "index.html";
}

// ===========================
// BLOCK DASHBOARD IF NOT LOGGED IN
// ===========================
window.onload = function () {
    let teacher = localStorage.getItem("teacher");

    if (window.location.pathname.includes("teacher_dashboard.html") && !teacher) {
        alert("Please login first");
        window.location = "index.html";
    }

    if (window.location.pathname.includes("verify.html")) {
        ensureFaceModelsLoaded();
    }
};

window.addEventListener("beforeunload", () => {
    if (faceCameraStream) {
        faceCameraStream.getTracks().forEach(track => track.stop());
    }
});
