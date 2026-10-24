function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

// ================= PROFILE UPDATE LOGIC =================
function updateProfile(e) {
    e.preventDefault();
    const branch = document.getElementById("upBranch").value;
    const semester = document.getElementById("upSem").value;
    
    fetch('/api/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch, semester })
    }).then(res => res.json()).then(data => {
        const msg = document.getElementById("profMsg");
        msg.style.display = "block";
        msg.innerText = "✅ " + data.message;
        setTimeout(() => msg.style.display = "none", 3000);
    });
}

// ================= CALENDAR UI LOGIC =================
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();

function initCalendar() {
    renderCalendar(currentMonth, currentYear);
}

function changeMonth(dir) {
    currentMonth += dir;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar(currentMonth, currentYear);
}

function renderCalendar(month, year) {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("cal-month-year").innerText = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const calGrid = document.getElementById("cal-days");
    calGrid.innerHTML = "";
    
    // Empty boxes for days before 1st
    for (let i = 0; i < firstDay; i++) {
        calGrid.innerHTML += `<div class="cal-day empty"></div>`;
    }
    
    // Organize Logs by Date (YYYY-MM-DD)
    const logsByDate = {};
    attLogsRaw.forEach(log => {
        const d = new Date(log.date);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if(!logsByDate[dateStr]) logsByDate[dateStr] = [];
        logsByDate[dateStr].push(log);
    });

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dayLogs = logsByDate[dateStr] || [];
        
        let cssClass = "";
        if (dayLogs.length > 0) {
            // Check if present in at least half classes
            const presents = dayLogs.filter(l => l.status === 'Present').length;
            if (presents >= (dayLogs.length / 2.0)) cssClass = "cal-present"; // Green
            else cssClass = "cal-absent"; // Red
        }
        
        const logsJson = encodeURIComponent(JSON.stringify(dayLogs));
        calGrid.innerHTML += `<div class="cal-day ${cssClass}" onclick="showDayDetails(${year}, ${month}, ${day}, '${logsJson}')">${day}</div>`;
    }
}

function showDayDetails(year, month, day, logsJsonStr) {
    const logs = JSON.parse(decodeURIComponent(logsJsonStr));
    const container = document.getElementById("day-details-container");
    const list = document.getElementById("dd-classes-list");
    
    const d = new Date(year, month, day);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById("dd-title").innerText = d.toLocaleDateString('en-US', options);
    
    list.innerHTML = "";
    
    if (logs.length === 0) {
        document.getElementById("dd-subtitle").innerText = "No classes scheduled or attended on this day.";
        container.style.display = "block";
        return;
    }

    const presents = logs.filter(l => l.status === 'Present').length;
    document.getElementById("dd-subtitle").innerText = `Classes: ${logs.length} | Present: ${presents} | Absent: ${logs.length - presents}`;

    logs.forEach(log => {
        const isPres = log.status === 'Present';
        const icon = isPres ? '✔ Present' : '❌ Absent';
        const color = isPres ? '#4ade80' : '#ef4444';
        const border = isPres ? '#10b981' : '#ef4444';
        
        list.innerHTML += `
            <div class="class-row" style="border-left-color: ${border};">
                <div>
                    <strong style="color: #f8fafc; font-size: 16px;">${log.subjectName}</strong><br>
                    <span style="color: #94a3b8; font-size: 12px;">Recorded at ${new Date(log.date).toLocaleTimeString()}</span>
                </div>
                <div style="color: ${color}; font-weight: bold; font-size: 14px;">${icon}</div>
            </div>`;
    });
    
    container.style.display = "block";
    container.scrollIntoView({ behavior: 'smooth' });
}

// Call init on load
window.onload = () => { if(typeof attLogsRaw !== 'undefined') initCalendar(); };

// ================= COURSE DETAILS & QUIZZES =================
let activeBatchId = null;

function openCourseDetails(batchId, subjectName, profName) {
    document.getElementById("dashboard").style.display = "none";
    document.getElementById("course-details").style.display = "block";
    document.getElementById("cd-title").innerText = subjectName;
    document.getElementById("cd-prof").innerText = "Taught by: Prof. " + profName;
    activeBatchId = batchId;
    fetchStudentQuizzes(batchId); 
}

function closeCourseDetails() {
    document.getElementById("course-details").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
}

function showSubTab(tabId) {
    document.querySelectorAll('.cd-subtab').forEach(el => el.style.display = "none");
    document.getElementById(tabId).style.display = "block";
}

// ================= FAST GPS QR SCANNER =================
function getDeviceId() {
    let id = localStorage.getItem('mits_device_id');
    if (!id) { id = 'DEV_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('mits_device_id', id); }
    return id;
}

let html5QrcodeScanner;
function showStatus(msg, type) { 
    const el = document.getElementById("status"); el.style.display = "block"; el.innerText = msg;
    if(type==='success'){ el.style.color="#4ade80"; el.style.borderColor="#10b981"; } else { el.style.color="#f87171"; el.style.borderColor="#ef4444"; }
}

function startScanner() {
    document.getElementById("reader").style.display = "block";
    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
    html5QrcodeScanner.render((qr) => {
        html5QrcodeScanner.clear(); document.getElementById("reader").style.display = "none";
        showStatus("⏳ Extracting Fast GPS Location...", "error");
        
        const sCb = (pos) => sendAtt(qr, pos.coords.latitude, pos.coords.longitude);
        const eCb = (err) => { showStatus("❌ Location (GPS) ON karna aur Allow karna zaroori hai tabhi attendance lagegi!", "error"); };
        
        if (navigator.geolocation) {
            // High accuracy off for speed, maxAge allows cached instant location
            navigator.geolocation.getCurrentPosition(sCb, eCb, {timeout:8000, enableHighAccuracy: false, maximumAge: 60000}); 
        } else {
            showStatus("❌ Browser does not support Location.", "error");
        }
    }, () => {});
}

function sendAtt(qrData, lat, lng) {
    let data; try { data = JSON.parse(qrData); } catch(e) { return showStatus("❌ Invalid QR.", "error"); }
    fetch('/api/mark-attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: currentStudentId, sessionId: data.sessionId, token: data.token, lat, lng, deviceId: getDeviceId() })
    }).then(res => res.json()).then(r => { 
        if(r.success) showStatus("✅ "+r.message, "success"); 
        else showStatus("❌ "+r.error, "error"); 
    });
}

// ================= PROCTORED QUIZ ENGINE =================
// (Purana solid logic as it is rakha hai)
let quizActive = false, warnings = 0, maxWarnings = 3, currentQuizData = null, timerInterval = null, remainingSeconds = 0, shuffledQuestions = [];

function shuffleArray(array) {
    let newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

document.addEventListener("visibilitychange", () => {
    if(quizActive && document.hidden) {
        warnings++; document.getElementById('aq-warnings').innerText = warnings;
        if(warnings >= maxWarnings) { alert(`⚠️ Limit reached! Quiz Auto-Submitted.`); submitQuiz(true); } 
        else alert(`⚠️ WARNING ${warnings}/${maxWarnings} : Do NOT switch tabs!`);
    }
});

function fetchStudentQuizzes(batchId) {
    fetch(`/api/student-quizzes/${batchId}`).then(res => res.json()).then(data => {
        const container = document.getElementById('studentQuizList'); container.innerHTML = '';
        const serverTime = new Date(data.currentTime).getTime();
        if(data.quizzes.length === 0) return container.innerHTML = '<p style="color:#94a3b8;">No quizzes scheduled.</p>';

        data.quizzes.forEach(q => {
            const startTime = new Date(q.startTime).getTime(); const endTime = new Date(q.endTime).getTime();
            const result = data.results.find(r => r.quizId.toString() === q._id.toString());
            let statusHtml = '';
            
            if(result) { 
                if(serverTime < endTime) statusHtml = `<span style="color:#f59e0b;">⏳ Attempted. Results visible after ${new Date(q.endTime).toLocaleTimeString()}</span>`;
                else {
                    let bMsg = result.isBlocked ? `<span style="color:#ef4444;"> (BLOCKED)</span>` : '';
                    statusHtml = `<strong style="color:#4ade80;">Marks: ${result.score}/${result.totalQuestions}</strong> ${bMsg}<br><button onclick='viewDetailedResult(${JSON.stringify(q)}, ${JSON.stringify(result)})' style="background:#3b82f6; border:none; border-radius:3px; color:white; padding:5px 10px; margin-top:5px; cursor:pointer;">🔍 Analysis</button>`;
                }
            } else { 
                if(serverTime < startTime) statusHtml = `<span style="color:#94a3b8;">Starts at: ${new Date(q.startTime).toLocaleString()}</span>`;
                else if(serverTime >= startTime && serverTime <= endTime) statusHtml = `<button onclick='startQuizAttempt(${JSON.stringify(q)})' style="background:#10b981; border:none; border-radius:3px; color:white; padding:5px 15px; cursor:pointer;">▶ Start Quiz</button>`;
                else statusHtml = `<span style="color:#ef4444;">Missed (Time Over)</span>`;
            }
            container.innerHTML += `<div style="background:#1a1e29; padding:15px; border-radius:6px; margin-bottom:10px; border:1px solid #2a3140; display:flex; justify-content:space-between; align-items:center;"><div><strong style="color:#f8fafc; font-size:16px;">${q.title}</strong><br><span style="font-size:12px; color:#94a3b8;">Duration: ${q.duration} Mins</span></div><div>${statusHtml}</div></div>`;
        });
    });
}

function startQuizAttempt(quizObj) {
    currentQuizData = quizObj; quizActive = true; warnings = 0; maxWarnings = quizObj.maxTabSwitches || 3;
    document.getElementById('aq-title').innerText = quizObj.title;
    document.getElementById('aq-max-warnings').innerText = maxWarnings;
    document.getElementById('aq-warnings').innerText = "0";
    document.getElementById('active-quiz-screen').style.display = 'block';
    
    let questionsWithIndex = quizObj.questions.map((q, i) => ({...q, originalIndex: i}));
    shuffledQuestions = shuffleArray(questionsWithIndex); 
    const qContainer = document.getElementById('aq-questions-container'); qContainer.innerHTML = '';
    
    shuffledQuestions.forEach((q, idx) => {
        let opts = '';
        q.options.forEach((opt, optIdx) => {
            opts += `<label style="display:block; background:#131720; padding:10px; margin-top:10px; border-radius:5px; border:1px solid #2a3140;"><input type="radio" name="q_ans_${q.originalIndex}" value="${optIdx}"> ${opt}</label>`;
        });
        qContainer.innerHTML += `<div style="background:#1a1e29; padding:20px; border-radius:8px; margin-bottom:20px; border:1px solid #3b82f6;"><strong style="color:#f8fafc;">Q${idx+1}: ${q.questionText}</strong><div style="margin-top:10px;">${opts}</div></div>`;
    });

    remainingSeconds = quizObj.duration * 60; updateTimerUI();
    timerInterval = setInterval(() => {
        remainingSeconds--; updateTimerUI();
        if(remainingSeconds <= 0) { alert("⏰ Time up!"); submitQuiz(false); }
    }, 1000);
    try { document.documentElement.requestFullscreen(); } catch(e){}
}

function updateTimerUI() {
    const m = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
    const s = (remainingSeconds % 60).toString().padStart(2, '0');
    document.getElementById('aq-timer').innerText = `${m}:${s}`;
}

function submitQuiz(isBlocked = false) {
    if(!quizActive) return;
    clearInterval(timerInterval); quizActive = false;
    try { document.exitFullscreen(); } catch(e){}
    
    let score = 0; let answersArray = [];
    shuffledQuestions.forEach((q) => {
        const selected = document.querySelector(`input[name="q_ans_${q.originalIndex}"]:checked`);
        const selValue = selected ? parseInt(selected.value) : -1;
        if(selValue === q.correctOptionIndex) score++;
        answersArray.push({ questionIndex: q.originalIndex, selectedOption: selValue });
    });

    fetch('/api/submit-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: currentQuizData._id, score: score, tabSwitches: warnings, isBlocked: isBlocked, answers: answersArray })
    }).then(() => {
        document.getElementById('active-quiz-screen').style.display = 'none';
        fetchStudentQuizzes(activeBatchId); 
        if(isBlocked) alert("Blocked!"); else alert("Submitted Successfully!");
    });
}

function viewDetailedResult(quiz, result) {
    document.getElementById('quiz-result-modal').style.display = 'block';
    document.getElementById('res-title').innerText = quiz.title + " Analysis";
    document.getElementById('res-score').innerText = `Score: ${result.score} / ${result.totalQuestions}`;
    const container = document.getElementById('res-questions-container'); container.innerHTML = '';

    quiz.questions.forEach((q, qIndex) => {
        const stuAnswer = result.answers.find(a => a.questionIndex === qIndex);
        const selOpt = stuAnswer ? stuAnswer.selectedOption : -1;
        
        let optsHtml = '';
        q.options.forEach((opt, optIndex) => {
            let cssClass = 'padding:10px; margin-top:10px; border-radius:5px; border:1px solid #2a3140; background:#131720;'; 
            if(optIndex === q.correctOptionIndex) cssClass = 'padding:10px; margin-top:10px; border-radius:5px; border:1px solid #10b981; background:rgba(16, 185, 129, 0.2); color:#4ade80;'; 
            else if (optIndex === selOpt) cssClass = 'padding:10px; margin-top:10px; border-radius:5px; border:1px solid #ef4444; background:rgba(239, 68, 68, 0.2); color:#f87171;'; 
            
            let labelIcon = '';
            if(optIndex === selOpt && optIndex === q.correctOptionIndex) labelIcon = '✅ (Your Answer)';
            else if (optIndex === selOpt) labelIcon = '❌ (Your Answer)';
            else if (optIndex === q.correctOptionIndex) labelIcon = '✅ (Correct Answer)';

            optsHtml += `<div style="${cssClass}">${opt} <span style="float:right; font-weight:bold;">${labelIcon}</span></div>`;
        });
        if(selOpt === -1) optsHtml += `<p style="color:#f59e0b; margin-top:10px;">⚠️ You skipped this question.</p>`;
        container.innerHTML += `<div style="background:#1a1e29; padding:20px; border-radius:8px; margin-bottom:20px; border:1px solid #3b82f6;"><strong style="color:#f8fafc; font-size: 16px;">Q${qIndex + 1}: ${q.questionText}</strong><div style="margin-top:15px;">${optsHtml}</div></div>`;
    });
}