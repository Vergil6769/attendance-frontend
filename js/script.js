// ===========================
// CONFIG
// ===========================
const BACKEND_URL = "https://attendance-backend-pa84.onrender.com";

// ===========================
// TEACHER LOGIN
// ===========================
function teacherLogin() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

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
            alert("Invalid Username or Password");
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
    const division = document.getElementById("division").value;
    const lecture = document.getElementById("lecture").value;
    const teacher = localStorage.getItem("teacher");

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
            document.getElementById("lecture_name").innerText =
                "Subject: " + data.subject;

            // Load first QR immediately
            loadQR();

            // Refresh QR every 5 seconds
            window.qrInterval = setInterval(loadQR, 5000);

        } else if (data.status === "no_lecture_today") {
            alert("No lecture scheduled today");
        } else if (data.status === "timetable_missing") {
            alert("Timetable not found for division " + division);
        }
    })
    .catch(err => {
        console.log(err);
        alert("Server connection error");
    });
}

// ===========================
// LOAD QR (ROTATES EVERY 5 SEC)
// ===========================
function loadQR() {
    fetch(`${BACKEND_URL}/generate_qr?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
            const qr = document.getElementById("qr");
            if (qr && data.token) {
                qr.src = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + data.token;
            }
        })
        .catch(err => console.log(err));
}

// ===========================
// STOP ATTENDANCE
// ===========================
function stopAttendance() {
    fetch(`${BACKEND_URL}/stop_session`, { method: "POST" });

    const qr = document.getElementById("qr");
    if (qr) qr.src = "";

    const lectureName = document.getElementById("lecture_name");
    if (lectureName) lectureName.innerText = "";

    if (window.qrInterval) clearInterval(window.qrInterval);
}

// ===========================
// STUDENT LOGIN + FACE VERIFICATION + MARK ATTENDANCE
// ===========================
async function verifyAndMarkAttendance() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    // Get QR params from URL
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session");
    const token = params.get("token");

    if (!token) { alert("Invalid QR Code"); return; }

    // --- Step 1: Student Login ---
    let loginRes = await fetch(`${BACKEND_URL}/student_login`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password })
    });
    let loginData = await loginRes.json();

    if (loginData.status !== "success") {
        alert("Invalid Student ID or Password");
        return;
    }

    // --- Step 2: Capture webcam image (front camera) ---
    const imageBase64 = await captureWebcamImage(); // implement this function to get base64 from webcam
    if (!imageBase64) {
        alert("Could not capture image");
        return;
    }

    // --- Step 3: Face Verification ---
    let verifyRes = await fetch(`${BACKEND_URL}/verify_face`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, angle: "front", image: imageBase64 })
    });
    let verifyData = await verifyRes.json();

    if (!verifyData.match) {
        alert("Face verification failed. Try again.");
        return;
    }

    // --- Step 4: Mark Attendance ---
    let markRes = await fetch(`${BACKEND_URL}/mark_attendance`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            username: username,
            name: loginData.name,
            roll: loginData.roll,
            division: loginData.division,
            session: session,
            token: token
        })
    });
    let markData = await markRes.json();

    if (markData.status === "present") alert("Attendance marked successfully");
    else alert(markData.status || "Error marking attendance");
}

// ===========================
// LOAD ATTENDANCE
// ===========================
function loadAttendance() {
    const division = document.getElementById("division_view").value;

    fetch(`${BACKEND_URL}/attendance_by_division?division=${division}`)
        .then(res => res.json())
        .then(data => {
            const table = document.getElementById("attendance_table");
            table.innerHTML = "";

            data.forEach(row => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${row.Name}</td>
                    <td>${row.Roll}</td>
                    <td>${row.Subject}</td>
                    <td>${row.Lecture}</td>
                    <td>${row.Date}</td>
                    <td>${row.Time}</td>
                `;
                table.appendChild(tr);
            });
        })
        .catch(err => console.log(err));
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
    const teacher = localStorage.getItem("teacher");

    if (window.location.pathname.includes("teacher_dashboard.html") && !teacher) {
        alert("Please login first");
        window.location = "index.html";
    }
};

// ===========================
// HELPER: CAPTURE WEBCAM IMAGE
// ===========================
function captureWebcamImage() {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                video.srcObject = stream;
                video.play();

                setTimeout(() => {
                    const canvas = document.createElement("canvas");
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
                    stream.getTracks().forEach(track => track.stop());
                    resolve(canvas.toDataURL("image/jpeg"));
                }, 1500); // wait 1.5s to allow camera to load
            })
            .catch(err => reject(err));
    });
}