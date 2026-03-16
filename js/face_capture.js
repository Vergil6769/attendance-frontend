// ===========================
// VARIABLES
// ===========================
let username = "";
let name = "";
let roll = "";
let division = "";

let angles = ["front", "right", "left"];
let currentAngle = 0;
let faceVerified = false;
let faceTimer = null;

const BACKEND_URL = "https://attendance-backend-pa84.onrender.com";

// ===========================
// ELEMENTS
// ===========================
const loginBtn = document.getElementById("login-btn");
const faceSection = document.getElementById("face-section");
const qrSection = document.getElementById("qr-section");
const camera = document.getElementById("camera");
const captureBtn = document.getElementById("capture-btn");
const angleInfo = document.getElementById("angle-info");
const timerDisplay = document.getElementById("timer");
const qrCamera = document.getElementById("qr-camera");

// ===========================
// STEP 1: STUDENT LOGIN
// ===========================
loginBtn.addEventListener("click", () => {

    username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch(`${BACKEND_URL}/student_login`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({username,password})
    })
    .then(res => res.json())
    .then(data => {

        if(data.status === "success"){

            name = data.name;
            roll = data.roll;
            division = data.division;

            document.getElementById("login-section").style.display = "none";
            faceSection.style.display = "block";

            startCamera();

        } else {
            alert("Login failed");
        }
    });
});

// ===========================
// STEP 2: FRONT CAMERA CAPTURE
// ===========================
function startCamera(){

    navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}})
    .then(stream => {
        camera.srcObject = stream;
    })
    .catch(err => alert("Camera access denied"));

}

captureBtn.addEventListener("click", captureAngle);

function captureAngle(){

    const canvas = document.createElement("canvas");
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;

    canvas.getContext("2d").drawImage(camera,0,0);

    const image = canvas.toDataURL("image/jpeg");

    fetch(`${BACKEND_URL}/verify_face`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
            username,
            angle: angles[currentAngle],
            image
        })
    })
    .then(res => res.json())
    .then(data => {

        if(data.match){

            currentAngle++;

            if(currentAngle < angles.length){

                angleInfo.innerText = "Angle: " + angles[currentAngle];

            } else {

                faceVerified = true;

                alert("Face verification successful! Valid for 10 seconds.");

                startFaceTimer();
                startQRScan();

            }

        } else {

            alert("Face verification failed. Retry from front angle.");

            currentAngle = 0;
            angleInfo.innerText = "Angle: " + angles[currentAngle];

        }

    });
}

// ===========================
// FACE VERIFICATION TIMER
// ===========================
function startFaceTimer(){

    let time = 10;

    timerDisplay.innerText = "Timer: "+time+"s";

    faceTimer = setInterval(()=>{

        time--;

        timerDisplay.innerText = "Timer: "+time+"s";

        if(time <= 0){

            clearInterval(faceTimer);

            faceVerified = false;

            fetch(`${BACKEND_URL}/reset_face_verification`, {
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body: JSON.stringify({username})
            });

            alert("Face verification expired. Please verify again.");

            currentAngle = 0;
            angleInfo.innerText = "Angle: "+angles[currentAngle];

            qrSection.style.display = "none";
            faceSection.style.display = "block";

        }

    },1000);

}

// ===========================
// STEP 3: BACK CAMERA QR SCAN
// ===========================
function startQRScan(){

    faceSection.style.display = "none";
    qrSection.style.display = "block";

    navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}})
    .then(stream => {
        qrCamera.srcObject = stream;
    })
    .catch(err => alert("Back camera access denied"));

    let scanInterval = setInterval(()=>{

        const params = new URLSearchParams(window.location.search);

        const session = params.get("session");
        const token = params.get("token");

        if(faceVerified && token){

            markAttendance(session, token);

            clearInterval(scanInterval);

        }

    },1000);

}

// ===========================
// MARK ATTENDANCE
// ===========================
function markAttendance(session, token){

    fetch(`${BACKEND_URL}/mark_attendance`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({

            username: username,
            name: name,
            roll: roll,
            division: division,

            session: session,
            token: token

        })
    })
    .then(res => res.json())
    .then(data => {

        if(data.status === "present"){

            alert("Attendance marked successfully!");

        }
        else if(data.status === "face_verification_invalid"){

            alert("Face verification expired. Retry.");

            qrSection.style.display = "none";
            faceSection.style.display = "block";

            currentAngle = 0;

        }
        else if(data.status === "invalid_qr"){

            alert("Invalid QR code.");

        }
        else if(data.status === "qr_expired"){

            alert("QR expired.");

        }
        else if(data.status === "already_marked"){

            alert("Attendance already marked.");

        }
        else{

            alert("Error marking attendance.");

        }

    })
    .catch(err=>{
        console.log(err);
        alert("Server error");
    });

}