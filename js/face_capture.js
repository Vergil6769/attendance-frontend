// ===========================
// VARIABLES
// ===========================
let username = "";
let name = "";
let roll = "";
let division = "";

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

const timerDisplay = document.getElementById("timer");
const qrCamera = document.getElementById("qr-camera");


// ===========================
// STEP 1: STUDENT LOGIN
// ===========================
loginBtn.addEventListener("click", async () => {

    username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {

        const res = await fetch(`${BACKEND_URL}/student_login`, {

            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({username,password})

        });

        const data = await res.json();

        if(data.status === "success") {

            name = data.name;
            roll = data.roll;
            division = data.division;

            document.getElementById("login-section").style.display = "none";
            faceSection.style.display = "block";

            startCamera();

        } 
        else {

            alert("Login failed");

        }

    } 
    catch(err){

        console.log(err);
        alert("Server error during login");

    }

});


// ===========================
// STEP 2: START FRONT CAMERA
// ===========================
function startCamera(){

    navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}})

    .then(stream => {

        camera.srcObject = stream;

    })

    .catch(err => {

        console.log(err);
        alert("Camera access denied");

    });

}


// ===========================
// CAPTURE IMAGE
// ===========================
function captureImage(){

    const canvas = document.createElement("canvas");

    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(camera, 0, 0);

    return canvas.toDataURL("image/jpeg");

}


// ===========================
// FACE VERIFICATION
// ===========================
captureBtn.addEventListener("click", verifyFace);

async function verifyFace(){

    const image = captureImage();

    try {

        const res = await fetch(`${BACKEND_URL}/verify_face`, {

            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({

                username: username,
                image: image

            })

        });

        const data = await res.json();

        if(data.match){

            faceVerified = true;

            alert("Face verification successful! Valid for 10 seconds.");

            startFaceTimer();
            startQRScan();

        }
        else{

            alert("Face verification failed. Try again.");

        }

    } 
    catch(err){

        console.log(err);
        alert("Server error during face verification");

    }

}


// ===========================
// FACE VERIFICATION TIMER
// ===========================
function startFaceTimer(){

    let time = 10;

    timerDisplay.innerText = "Timer: " + time + "s";

    faceTimer = setInterval(()=>{

        time--;

        timerDisplay.innerText = "Timer: " + time + "s";

        if(time <= 0){

            clearInterval(faceTimer);

            faceVerified = false;

            fetch(`${BACKEND_URL}/reset_face_verification`, {

                method:"POST",
                headers:{"Content-Type":"application/json"},
                body: JSON.stringify({username})

            });

            alert("Face verification expired. Please verify again.");

            qrSection.style.display = "none";
            faceSection.style.display = "block";

        }

    },1000);

}


// ===========================
// STEP 3: QR SCAN
// ===========================
function startQRScan(){

    faceSection.style.display = "none";
    qrSection.style.display = "block";

    navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}})

    .then(stream => {

        qrCamera.srcObject = stream;

    })

    .catch(err => {

        console.log(err);
        alert("Back camera access denied");

    });

    const scanInterval = setInterval(()=>{

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
async function markAttendance(session, token){

    try {

        const res = await fetch(`${BACKEND_URL}/mark_attendance`, {

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

        });

        const data = await res.json();

        if(data.status === "present"){

            alert("Attendance marked successfully!");

        }
        else if(data.status === "face_verification_invalid"){

            alert("Face verification expired. Retry.");

            qrSection.style.display = "none";
            faceSection.style.display = "block";

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

    } 
    catch(err){

        console.log(err);
        alert("Server error while marking attendance");

    }

}