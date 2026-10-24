function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

function showDbTab(tabId) {
    document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

let activeBatchId = null;
let activeBranch = null;

function openDedicatedBatchView(batchId, subjectName, branch) {
    document.getElementById('main-dashboard').style.display = 'none';
    document.getElementById('main-nav').style.display = 'none';
    document.getElementById('dedicated-batch-dashboard').style.display = 'block';
    
    document.getElementById('db-title').innerText = subjectName + " Dashboard";
    activeBatchId = batchId;
    activeBranch = branch;
    
    fetch(`/api/batch/${batchId}`).then(res => res.json()).then(data => {
        const batch = data.batch;
        const branchStudents = data.branchStudents;
        
        let html = '';
        if(branchStudents.length === 0) {
            html = '<span style="color:#ef4444;">No students found in this branch.</span>';
        } else {
            branchStudents.forEach(st => {
                const isChecked = batch.students.includes(st.userId) ? 'checked' : '';
                html += `
                    <label style="display:block; margin-bottom:8px; cursor:pointer;">
                        <input type="checkbox" class="edit-stu-cb" value="${st.userId}" ${isChecked}> 
                        <span style="color:#4ade80;">${st.userId}</span> - ${st.name}
                    </label>`;
            });
        }
        document.getElementById('editStudentList').innerHTML = html;
    });

    loadQuizzes();
}

function closeDedicatedBatchView() {
    document.getElementById('dedicated-batch-dashboard').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'block';
    document.getElementById('main-nav').style.display = 'flex';
    activeBatchId = null;
}

// ================= FAST GPS LOCATION LOGIC =================
const socket = io();
let qrcode = new QRCode(document.getElementById("qr-code"), { width: 230, height: 230 });
let currentSessionId = null;

function startSession(mode) {
    const time = document.getElementById("globalQrTime").value; 
    const batchId = document.getElementById("globalBatchSelect").value; 
    if(!batchId) return alert("Select Batch!");
    
    const btn = document.getElementById("startBtn");
    btn.innerText = "⏳ GENERATING QR...";
    btn.style.backgroundColor = "#f59e0b"; // Yellow while loading
    btn.disabled = true;
    
    const sCb = (pos) => {
        emitAttendanceData(pos.coords.latitude, pos.coords.longitude, time, batchId);
        btn.innerText = "▶ START QR";
        btn.style.backgroundColor = "#10b981"; // Back to green
        btn.disabled = false;
    };
    
    const eCb = (err) => {
        alert("❌ STRICT MODE: Location (GPS) ON karna aur permission Allow karna zaroori hai tabhi QR banega!");
        btn.innerText = "▶ START QR";
        btn.style.backgroundColor = "#10b981";
        btn.disabled = false;
    };
    
    if (navigator.geolocation) {
        // High accuracy off and maximumAge used to speed up generation!
        navigator.geolocation.getCurrentPosition(sCb, eCb, {timeout: 8000, enableHighAccuracy: false, maximumAge: 60000}); 
    } else {
        alert("Geolocation is not supported by your browser.");
        btn.innerText = "▶ START QR";
        btn.style.backgroundColor = "#10b981";
        btn.disabled = false;
    }
}

function emitAttendanceData(lat, lng, time, batchId) {
    document.getElementById("qr-code").style.display = "block";
    document.getElementById("startBtn").style.display = "none";
    document.getElementById("stopBtn").style.display = "inline-block";
    socket.emit('start-attendance', { profId, batchId, time, lat, lng });
}
socket.on('session-started', (data) => currentSessionId = data.sessionId);
socket.on('qr-update', (data) => { qrcode.clear(); qrcode.makeCode(JSON.stringify(data)); });

function stopSession() {
    if(currentSessionId) {
        socket.emit('stop-attendance', currentSessionId);
        document.getElementById("qr-code").style.display = "none";
        document.getElementById("startBtn").style.display = "inline-block";
        document.getElementById("stopBtn").style.display = "none";
        alert("Session Stopped! Absent students have been automatically marked in the database.");
    }
}

// MANUAL ATTENDANCE & EDIT
function fetchManualData() {
    const date = document.getElementById('manualDate').value;
    if(!date) return alert("Select Date!");
    fetch(`/api/attendance/${activeBatchId}/${date}`).then(res => res.json()).then(data => {
        const tbody = document.getElementById('manualTableBody'); tbody.innerHTML = '';
        data.students.forEach(st => {
            const isPresent = st.status === 'Present';
            tbody.innerHTML += `<tr>
                <td>${st.userId}</td><td>${st.name}</td>
                <td>
                    <select class="manual-status-dd" data-userid="${st.userId}" style="width:100px; padding:5px; color:${isPresent?'#4ade80':'#ef4444'}; font-weight:bold;">
                        <option value="Present" ${isPresent?'selected':''} style="color:#4ade80;">Present</option>
                        <option value="Absent" ${!isPresent?'selected':''} style="color:#ef4444;">Absent</option>
                    </select>
                </td></tr>`;
        });
        document.getElementById('manualTableContainer').style.display = 'block';
    });
}

function saveManualData() {
    const date = document.getElementById('manualDate').value;
    const attendanceData = Array.from(document.querySelectorAll('.manual-status-dd')).map(dd => ({ userId: dd.getAttribute('data-userid'), status: dd.value }));
    fetch('/api/update-attendance', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ batchId: activeBatchId, date, attendanceData }) })
    .then(res => res.json()).then(() => {
        const msg = document.getElementById('manualStatusMsg'); msg.style.display = 'block'; msg.innerText = "✅ Updated Successfully!";
        setTimeout(() => msg.style.display = 'none', 3000);
    });
}

function saveEditedBatch() {
    const selectedStudents = Array.from(document.querySelectorAll('.edit-stu-cb:checked')).map(cb => cb.value);
    fetch('/api/update-batch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ batchId: activeBatchId, students: selectedStudents }) })
    .then(() => {
        alert("Students Updated Successfully!");
        window.location.reload(); 
    });
}

// QUIZ CREATION
let qCount = 0;
function addQuestionField() {
    qCount++;
    const html = `
        <div class="q-box" id="q${qCount}">
            <strong>Q${qCount}:</strong> <input type="text" class="q-text" placeholder="Question Text" required style="width:100%; margin-top:5px;">
            <div style="display:flex; gap:10px; margin-top:10px;">
                <input type="text" class="q-opt" placeholder="Option A" required style="flex:1;">
                <input type="text" class="q-opt" placeholder="Option B" required style="flex:1;">
                <input type="text" class="q-opt" placeholder="Option C" required style="flex:1;">
                <input type="text" class="q-opt" placeholder="Option D" required style="flex:1;">
            </div>
            <select class="q-ans" style="margin-top:10px; width:auto; padding:5px;" required>
                <option value="" disabled selected>Select Correct Answer</option>
                <option value="0">Option A</option><option value="1">Option B</option>
                <option value="2">Option C</option><option value="3">Option D</option>
            </select>
        </div>`;
    document.getElementById('questionsContainer').insertAdjacentHTML('beforeend', html);
}

function submitNewQuiz() {
    const questions = [];
    document.querySelectorAll('.q-box').forEach(box => {
        questions.push({
            questionText: box.querySelector('.q-text').value,
            options: Array.from(box.querySelectorAll('.q-opt')).map(i => i.value),
            correctOptionIndex: parseInt(box.querySelector('.q-ans').value)
        });
    });
    const payload = {
        batchId: activeBatchId, title: document.getElementById('qTitle').value,
        startTime: document.getElementById('qStart').value, endTime: document.getElementById('qEnd').value,
        duration: document.getElementById('qDur').value, maxSwitches: document.getElementById('qSwitch').value,
        questions: questions
    };
    fetch('/api/create-quiz', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(res => res.json()).then(res => {
        alert(res.message);
        document.getElementById('quizFormBox').style.display='none';
        loadQuizzes();
    });
}

function loadQuizzes() {
    fetch(`/api/batch-details/${activeBatchId}`).then(res => res.json()).then(data => {
        let html = '';
        data.quizzes.forEach(q => {
            html += `<div class="batch-item">
                        <div><strong>${q.title}</strong><br><span style="color:#94a3b8; font-size:12px;">Result Time: ${new Date(q.endTime).toLocaleString()}</span></div>
                        <button class="btn-small" style="background:#3b82f6; border:none; color:white; border-radius:5px; cursor:pointer;" onclick="viewRankList('${q._id}')">🏆 View Rank List</button>
                     </div>
                     <div id="rank-${q._id}" style="display:none; background:#131720; padding:15px; margin-bottom:15px; border-radius:5px; border:1px solid #3b82f6;"></div>`;
        });
        document.getElementById('quizListContainer').innerHTML = html;
    });
}

function viewRankList(quizId) {
    const container = document.getElementById(`rank-${quizId}`);
    if(container.style.display === 'block') { container.style.display = 'none'; return; }
    fetch(`/api/quiz-results/${quizId}`).then(res => res.json()).then(results => {
        let html = `<table style="width:100%; text-align:left;"><tr><th>Rank</th><th>Student ID</th><th>Score</th><th>Proctoring Status</th></tr>`;
        results.forEach((r, idx) => {
            let pStatus = r.isBlocked ? `<span style="color:#ef4444;">Blocked (${r.tabSwitches} switches)</span>` : `<span style="color:#4ade80;">Safe (${r.tabSwitches} switches)</span>`;
            html += `<tr><td>#${idx+1}</td><td>${r.studentId}</td><td>${r.score}/${r.totalQuestions}</td><td>${pStatus}</td></tr>`;
        });
        html += `</table>`;
        container.innerHTML = html; container.style.display = 'block';
    });
}