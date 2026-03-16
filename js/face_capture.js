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
// LOAD FACE-API MODELS
// ===========================
async function loadModels(){

    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");

}

loadModels().then(()=>{
    console.log("Face models loaded");
});


// ===========================
// STEP 1: STUDENT LOGIN
// ===========================
loginBtn.addEventListener("click", async () => {

    username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try{

        const res = await fetch(`${BACKEND_URL}/student_login`,{

            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({username,password})

        });

        const data = await res.json();

        if(data.status === "success"){

            name = data.name;
            roll = data.roll;
            division = data.division;

            document.getElementById("login-section").style.display = "none";
            faceSection.style.display = "block";

            startCamera();

        }
        else{

            alert("Login failed");

        }

    }
    catch(err){

        console.log(err);
        alert("Server error during login");

    }

});


// ===========================
// START FRONT CAMERA
// ===========================
function startCamera(){

    navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}})

    .then(stream=>{

        camera.srcObject = stream;

    })

    .catch(err=>{

        console.log(err);
        alert("Camera access denied");

    });

}


// ===========================
// FACE VERIFICATION
// ===========================
captureBtn.addEventListener("click", verifyFace);

async function verifyFace(){

    const detection = await faceapi
        .detectSingleFace(camera,new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if(!detection){

        alert("No face detected");
        return;

    }

    const descriptor = Array.from(detection.descriptor);

    try{

        const res = await fetch(`${BACKEND_URL}/verify_face`,{

            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({

                username: username,
                encoding: descriptor

            })

        });

        const data = await res.json();

        if(data.match){

            faceVerified = true;

            alert("Face verified! Valid for 10 seconds.");

            startFaceTimer();
            startQRScan();

        }
        else{

            alert("Face verification failed");

        }

    }
    catch(err){

        console.log(err);
        alert("Server error during face verification");

    }

}


// ===========================
// FACE TIMER
// ===========================
function startFaceTimer(){

    let time = 10;

    timerDisplay.innerText = "Timer: "+time+"s";

    faceTimer = setInterval(()=>{

        time--;

        timerDisplay.innerText = "Timer: "+time+"s";

        if(time<=0){

            clearInterval(faceTimer);

            faceVerified=false;

            fetch(`${BACKEND_URL}/reset_face_verification`,{

                method:"POST",
                headers:{"Content-Type":"application/json"},
                body: JSON.stringify({username})

            });

            alert("Face verification expired");

            qrSection.style.display="none";
            faceSection.style.display="block";

        }

    },1000);

}


// ===========================
// QR SCAN
// ===========================
function startQRScan(){

    faceSection.style.display="none";
    qrSection.style.display="block";

    navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}})

    .then(stream=>{

        qrCamera.srcObject = stream;

    })

    .catch(err=>{

        console.log(err);
        alert("Back camera access denied");

    });

    const scanInterval=setInterval(()=>{

        const params = new URLSearchParams(window.location.search);

        const session = params.get("session");
        const token = params.get("token");

        if(faceVerified && token){

            markAttendance(session,token);
            clearInterval(scanInterval);

        }

    },1000);

}


// ===========================
// MARK ATTENDANCE
// ===========================
async function markAttendance(session,token){

    try{

        const res = await fetch(`${BACKEND_URL}/mark_attendance`,{

            method:"POST",
            headers:{"Content-Type":"application/json"},

            body: JSON.stringify({

                username:username,
                name:name,
                roll:roll,
                division:division,
                session:session,
                token:token

            })

        });

        const data = await res.json();

        if(data.status==="present"){

            alert("Attendance marked successfully!");

        }
        else if(data.status==="face_verification_invalid"){

            alert("Face verification expired");

            qrSection.style.display="none";
            faceSection.style.display="block";

        }
        else if(data.status==="invalid_qr"){

            alert("Invalid QR code");

        }
        else if(data.status==="qr_expired"){

            alert("QR expired");

        }
        else if(data.status==="already_marked"){

            alert("Attendance already marked");

        }
        else{

            alert("Error marking attendance");

        }

    }
    catch(err){

        console.log(err);
        alert("Server error while marking attendance");

    }

}