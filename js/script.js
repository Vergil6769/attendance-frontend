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

        } 
        else {

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

            loadQR();

            // rotate QR every 4 seconds
            window.qrInterval = setInterval(loadQR, 4000);

        }
        else if (data.status === "no_lecture_today") {

            alert("No lecture scheduled today");

        }
        else if (data.status === "timetable_missing") {

            alert("Timetable not found for division " + division);

        }

    })
    .catch(err => {

        console.log(err);
        alert("Server connection error");

    });

}


// ===========================
// LOAD QR (ROTATES)
// ===========================
function loadQR() {

    fetch(`${BACKEND_URL}/generate_qr?t=${Date.now()}`)
    .then(res => res.json())
    .then(data => {

        const qr = document.getElementById("qr");

        if (qr && data.token) {

            const studentURL =
                "https://vergil6769.github.io/attendance-frontend/faceverify.html"
                + "?session=" + data.session
                + "&token=" + data.token;

            qr.src =
                "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data="
                + encodeURIComponent(studentURL);

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
// VIEW ATTENDANCE
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
// BLOCK DASHBOARD ACCESS
// ===========================
window.onload = function () {

    const teacher = localStorage.getItem("teacher");

    if (window.location.pathname.includes("teacher_dashboard.html") && !teacher) {

        alert("Please login first");
        window.location = "index.html";

    }

};