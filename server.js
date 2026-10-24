const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const path = require('path');

// Models
const User = require('./models/User');
const Batch = require('./models/Batch'); 
const Attendance = require('./models/Attendance');
const Quiz = require('./models/Quiz');
const QuizResult = require('./models/QuizResult');
const Event = require('./models/Event');
const Schedule = require('./models/Schedule');
const Complaint = require('./models/Complaint');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set('view engine', 'ejs');
app.use(express.json({limit: '50mb'})); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(session({ secret: 'mits_ams_secure_key', resave: false, saveUninitialized: true }));

mongoose.connect('mongodb://127.0.0.1:27017/mits_attendance')
    .then(() => console.log("✅ MongoDB Connected!"))
    .catch(err => console.log("❌ DB Error:", err));

// ================= NAYA: SINGLE SESSION SECURITY MANAGER =================
const activeLogins = {}; // Track active tokens per user

function isSessionValid(user, req) {
    if (!user) return false;
    // Agar existing token match nahi karta current req token se -> Multiple login detected
    if (activeLogins[user.userId] && activeLogins[user.userId] !== req.session.loginToken) return false;
    return true;
}

// ================= 🌐 AUTH ROUTES =================
app.get('/', (req, res) => res.render('auth', { error: null }));

app.post('/register', async (req, res) => {
    try {
        const { userId, password, name, role, branch, semester } = req.body;
        const existing = await User.findOne({ userId });
        if(existing) return res.render('auth', { error: "ID pehle se registered hai!" });
        await User.create({ userId, password, name, role, branch, semester });
        res.render('auth', { error: "Registration Successful! Login karein." });
    } catch(err) { res.render('auth', { error: "Server error" }); }
});

app.post('/login', async (req, res) => {
    const { userId, password } = req.body;
    const user = await User.findOne({ userId, password });
    if(!user) return res.render('auth', { error: "Galat ID/Password!" });
    
    req.session.userId = user._id;
    req.session.role = user.role;
    
    // NAYA: Session Login Token Generate kiya Dual App rokne ke liye
    const loginToken = uuidv4();
    req.session.loginToken = loginToken;
    activeLogins[user.userId] = loginToken;
    
    let isIncomplete = false;
    if (user.role === 'student') {
        const hasBranch = user.branch && String(user.branch).trim() !== "";
        const hasSemester = user.semester && String(user.semester).trim() !== "";
        if (!hasBranch || !hasSemester) isIncomplete = true;
    }
    req.session.profileIncomplete = isIncomplete;
    
    if(user.role === 'student') res.redirect('/student');
    else if(user.role === 'management') res.redirect('/management');
    else res.redirect('/prof');
});

app.post('/api/mandatory-profile-update', async (req, res) => {
    const { branch, semester } = req.body;
    const updateData = {};
    if (branch) updateData.branch = branch;
    if (semester) updateData.semester = semester;
    await User.findByIdAndUpdate(req.session.userId, updateData);
    req.session.profileIncomplete = false;
    res.json({ success: true, message: "Profile Updated Successfully!" });
});

// ================= STUDENT ROUTES =================
app.get('/student', async (req, res) => {
    if(!req.session.userId || req.session.role !== 'student') return res.redirect('/');
    const user = await User.findById(req.session.userId);
    
    // NAYA: Check for Dual Login
    if (!isSessionValid(user, req)) {
        req.session.destroy();
        return res.send("<script>alert('🚨 SECURITY ALERT: Aapka account kisi dusre device me login hua hai. Current session terminated!'); window.location.href='/';</script>");
    }

    const myCourses = await Batch.find({ students: user.userId }).lean();
    const myAttendance = await Attendance.find({ studentId: user.userId }).sort({ date: -1 });
    
    let totalOverallClasses = 0, totalAttendedOverall = 0;
    myCourses.forEach(course => {
        const attendedCount = myAttendance.filter(att => att.batchId.toString() === course._id.toString() && att.status === 'Present').length;
        course.attendedClasses = attendedCount;
        totalOverallClasses += course.totalClasses;
        totalAttendedOverall += attendedCount;
        course.percentage = course.totalClasses > 0 ? ((attendedCount / course.totalClasses) * 100).toFixed(1) : 0;
    });
    
    const overallPercentage = totalOverallClasses > 0 ? ((totalAttendedOverall / totalOverallClasses) * 100).toFixed(1) : 0;
    const myComplaints = await Complaint.find({ studentId: user.userId }).sort({ createdAt: -1 });

    res.render('student', { user, courses: myCourses, attendance: myAttendance, overallPercentage, totalOverallClasses, totalAttendedOverall, profileIncomplete: req.session.profileIncomplete, myComplaints });
});

app.post('/api/submit-complaint', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const { building, floor, roomNo, type, notes, photoBase64 } = req.body;
        await Complaint.create({ studentId: user.userId, studentName: user.name, building, floor, roomNo, type, notes, photoBase64 });
        res.json({ success: true, message: "Issue Reported Successfully! Management is notified." });
    } catch(err) { res.json({ success: false, error: "Image too large or server error" }); }
});

app.get('/api/all-student-quizzes', async (req, res) => {
    const user = await User.findById(req.session.userId);
    const myCourses = await Batch.find({ students: user.userId });
    const batchIds = myCourses.map(c => c._id);
    const quizzes = await Quiz.find({ batchId: { $in: batchIds } }).sort({ startTime: 1 });
    const results = await QuizResult.find({ studentId: user.userId });
    res.json({ quizzes, results, currentTime: new Date(), courses: myCourses });
});

app.get('/api/student-quizzes/:batchId', async (req, res) => {
    const quizzes = await Quiz.find({ batchId: req.params.batchId });
    const user = await User.findById(req.session.userId);
    const results = await QuizResult.find({ studentId: user.userId, quizId: { $in: quizzes.map(q => q._id) } });
    res.json({ quizzes, results, currentTime: new Date() });
});

app.post('/api/submit-quiz', async (req, res) => {
    const { quizId, score, tabSwitches, isBlocked, answers } = req.body;
    const user = await User.findById(req.session.userId);
    const quiz = await Quiz.findById(quizId);
    const existing = await QuizResult.findOne({ quizId: quiz._id, studentId: user.userId });
    if(!existing) { await QuizResult.create({ quizId: quiz._id, studentId: user.userId, score, totalQuestions: quiz.questions.length, tabSwitches, isBlocked, answers }); }
    res.json({ success: true });
});

// ================= PROFESSOR ROUTES =================
app.get('/prof', async (req, res) => {
    if(!req.session.userId || req.session.role !== 'professor') return res.redirect('/');
    const user = await User.findById(req.session.userId);
    
    // NAYA: Check for Dual Login
    if (!isSessionValid(user, req)) {
        req.session.destroy(); return res.send("<script>alert('🚨 Multiple logins detected! Logged out.'); window.location.href='/';</script>");
    }

    const allStudents = await User.find({ role: 'student' }).sort({ userId: 1 });
    const allProfessors = await User.find({ role: 'professor' }).sort({ name: 1 }); 
    const myBatches = await Batch.find({ profId: user.userId });
    
    let totalClassesConducted = 0; let totalPresents = 0; let totalExpected = 0;
    const batchIds = myBatches.map(b => b._id);
    const allAttendance = await Attendance.find({ batchId: { $in: batchIds } });
    
    myBatches.forEach(batch => { totalClassesConducted += batch.totalClasses; totalExpected += (batch.totalClasses * batch.students.length); });
    totalPresents = allAttendance.filter(a => a.status === 'Present').length;
    let overallAttendancePercent = totalExpected > 0 ? ((totalPresents / totalExpected) * 100).toFixed(2) : 0;

    const myEvents = await Event.find({ profId: user.userId }).sort({ eventDate: 1 });
    const todayZero = new Date(); todayZero.setHours(0,0,0,0);
    const upcomingEvents = myEvents.filter(e => new Date(e.eventDate) >= todayZero).slice(0, 3);

    const mySchedules = await Schedule.find({ profId: user.userId }).sort({ startTime: 1 });
    const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = daysArr[new Date().getDay()];
    const todaysSchedules = mySchedules.filter(s => s.dayOfWeek === todayName);

    res.render('prof', { 
        user, students: allStudents, batches: myBatches, 
        stats: { overallAttendance: overallAttendancePercent, classesConducted: totalClassesConducted, activeCourses: myBatches.length },
        events: myEvents, upcomingEvents, mySchedules, todaysSchedules, todayName, allProfessors
    });
});

app.post('/create-batch', async (req, res) => {
    const { branch, semester, section, subjectName, students } = req.body;
    const prof = await User.findById(req.session.userId);
    const batchName = `${branch} - Sem ${semester} - Sec ${section}`;
    const studentArray = Array.isArray(students) ? students : (students ? [students] : []);
    await Batch.create({ batchName, subjectName, branch, semester, section, profId: prof.userId, profName: prof.name, students: studentArray });
    res.redirect('/prof');
});

app.get('/api/batch-details/:batchId', async (req, res) => {
    const batch = await Batch.findById(req.params.batchId);
    const quizzes = await Quiz.find({ batchId: req.params.batchId }).sort({ createdAt: -1 });
    res.json({ batch, quizzes });
});

app.post('/api/create-quiz', async (req, res) => {
    const { batchId, title, duration, startTime, endTime, maxSwitches, questions } = req.body;
    await Quiz.create({ batchId, title, duration, startTime, endTime, maxTabSwitches: maxSwitches, questions });
    res.json({ success: true, message: "Quiz Created Successfully!" });
});

app.get('/api/quiz-results/:quizId', async (req, res) => {
    const results = await QuizResult.find({ quizId: req.params.quizId }).sort({ score: -1, submittedAt: 1 }); 
    res.json(results);
});

app.post('/api/add-event', async (req, res) => {
    const { title, eventType, eventDate } = req.body;
    const user = await User.findById(req.session.userId);
    await Event.create({ profId: user.userId, title, eventType, eventDate });
    res.redirect('/prof'); 
});

app.post('/api/add-schedule', async (req, res) => {
    const { batchId, dayOfWeek, startTime, endTime, room } = req.body;
    const user = await User.findById(req.session.userId);
    const batch = await Batch.findById(batchId);
    if(batch) {
        const safeSubjectName = batch.subjectName || "Subject: " + batch.batchName;
        await Schedule.create({ profId: user.userId, batchId: batch._id, subjectName: safeSubjectName, dayOfWeek, startTime, endTime, room });
    }
    res.redirect('/prof');
});

app.get('/api/batch/:id', async (req, res) => { 
    const batch = await Batch.findById(req.params.id);
    const branchStudents = await User.find({ role: 'student', branch: batch.branch, semester: batch.semester }).sort({ userId: 1 });
    res.json({ batch, branchStudents }); 
});

app.post('/api/update-batch', async (req, res) => {
    const studentArray = Array.isArray(req.body.students) ? req.body.students : (req.body.students ? [req.body.students] : []);
    await Batch.findByIdAndUpdate(req.body.batchId, { students: studentArray });
    res.json({ success: true });
});

app.get('/api/attendance/:batchId/:date', async (req, res) => {
    const batch = await Batch.findById(req.params.batchId);
    const targetDate = new Date(req.params.date);
    const start = new Date(targetDate.setHours(0,0,0,0));
    const end = new Date(targetDate.setHours(23,59,59,999));
    const records = await Attendance.find({ batchId: req.params.batchId, date: { $gte: start, $lte: end } });
    const studentsInBatch = await User.find({ userId: { $in: batch.students } }).sort({ userId: 1 });
    const result = studentsInBatch.map(st => {
        const rec = records.find(r => r.studentId === st.userId);
        return { userId: st.userId, name: st.name, status: rec ? rec.status : 'Absent' };
    });
    res.json({ students: result });
});

app.post('/api/update-attendance', async (req, res) => {
    const { batchId, date, attendanceData } = req.body;
    const batch = await Batch.findById(batchId);
    const targetDate = new Date(date); targetDate.setHours(12,0,0,0);
    const start = new Date(targetDate); start.setHours(0,0,0,0);
    const end = new Date(targetDate); end.setHours(23,59,59,999);
    
    const previousRecords = await Attendance.countDocuments({ batchId, date: { $gte: start, $lte: end } });
    await Attendance.deleteMany({ batchId, date: { $gte: start, $lte: end } });
    
    const newRecords = attendanceData.map(d => ({ studentId: d.userId, batchId, subjectName: batch.subjectName, date: targetDate, status: d.status }));
    
    if(newRecords.length > 0) await Attendance.insertMany(newRecords);
    if(previousRecords === 0 && newRecords.length > 0) await Batch.findByIdAndUpdate(batchId, { $inc: { totalClasses: 1 } });
    res.json({ success: true });
});

// ================= MANAGEMENT DASHBOARD =================
app.get('/management', async (req, res) => {
    if(!req.session.userId || req.session.role !== 'management') return res.redirect('/');
    const user = await User.findById(req.session.userId);
    if (!isSessionValid(user, req)) {
        req.session.destroy(); return res.send("<script>alert('🚨 Multiple logins detected! Logged out.'); window.location.href='/';</script>");
    }
    const complaints = await Complaint.find().sort({ createdAt: -1 }); 
    res.render('management', { user, complaints });
});

app.post('/api/resolve-complaint/:id', async (req, res) => {
    await Complaint.findByIdAndUpdate(req.params.id, { status: 'Resolved' });
    res.json({ success: true });
});

// ================= ANTI-PROXY DYNAMIC QR ENGINE =================
let activeSessions = {}; let sessionIntervals = {};

// GEOFENCING MATH LOGIC (Haversine Formula to calculate distance in meters)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in metres
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
}

io.on('connection', (socket) => {
    socket.on('start-attendance', async (data) => {
        const sessionId = uuidv4();
        // Professor ki GPS lat/lng save ho rahi hai active session mein
        activeSessions[sessionId] = { ...data, token: uuidv4() };
        socket.join(sessionId);
        await Batch.findByIdAndUpdate(data.batchId, { $inc: { totalClasses: 1 } });
        socket.emit('session-started', { sessionId }); 
        sessionIntervals[sessionId] = setInterval(() => {
            if(activeSessions[sessionId]) {
                activeSessions[sessionId].token = uuidv4(); 
                io.to(sessionId).emit('qr-update', { sessionId, token: activeSessions[sessionId].token });
            }
        }, data.time * 1000);
    });

    socket.on('stop-attendance', async (sessionId) => {
        if(sessionIntervals[sessionId]) { 
            const sessionData = activeSessions[sessionId];
            clearInterval(sessionIntervals[sessionId]); delete activeSessions[sessionId]; 
            try {
                const batch = await Batch.findById(sessionData.batchId);
                if(batch) {
                    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
                    const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);
                    const presents = await Attendance.find({ batchId: batch._id, date: { $gte: startOfDay, $lte: endOfDay }, status: 'Present' });
                    const presentIds = presents.map(p => p.studentId);
                    const absentIds = batch.students.filter(id => !presentIds.includes(id));
                    const absentRecords = absentIds.map(id => ({ studentId: id, batchId: batch._id, subjectName: batch.subjectName, date: new Date(), status: 'Absent' }));
                    if(absentRecords.length > 0) await Attendance.insertMany(absentRecords);
                }
            } catch(e) { console.error(e); }
        }
    });
});

app.post('/api/mark-attendance', async (req, res) => {
    const { studentId, sessionId, token, lat, lng, accuracy, deviceId } = req.body;
    const session = activeSessions[sessionId];
    if (!session) return res.status(400).json({ error: "Class over ho chuki hai." });
    if (session.token !== token) return res.status(400).json({ error: "QR Expired! Samne screen se scan karein." });

    const user = await User.findOne({ userId: studentId });
    const batch = await Batch.findById(session.batchId);
    if (!batch || !batch.students.includes(studentId)) return res.status(403).json({ error: "Aap is batch me nahi hain!" });

    // ================= LOOPHOLE 1: FAKE GPS & GEOFENCING CHECK =================
    if (accuracy > 1500) {
        return res.status(403).json({ error: "🚨 MOCK LOCATION DETECTED: Fake GPS is not allowed." });
    }
    const dist = getDistance(session.lat, session.lng, lat, lng);
    if (dist > 50) { // 50 METERS RADIUS LIMIT
        return res.status(403).json({ error: `🚨 LOCATION BLOCKED: Aap class se ${Math.round(dist)} meter door hain! Proxy lagana mana hai.` });
    }

    // ================= LOOPHOLE 3 & 4: STRICT DEVICE ID BINDING =================
    // Ab device ID khali hai toh hi save hogi, ek baar save hone par bina admin ke change nahi hogi
    if (!user.registeredDevice) {
        user.registeredDevice = deviceId; await user.save();
    } else if (user.registeredDevice !== deviceId) {
        return res.status(403).json({ error: "🚨 DEVICE BLOCKED: Ye aapka primary registered phone nahi hai. Device change karne ke liye HOD se sampark karein." });
    }

    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);
    
    const existingAtt = await Attendance.findOne({ studentId, batchId: session.batchId, date: { $gte: startOfDay, $lte: endOfDay } });
    if(!existingAtt) {
        await Attendance.create({ studentId, batchId: session.batchId, subjectName: batch.subjectName, status: 'Present' });
        res.json({ success: true, message: "Attendance Marked Successfully!" });
    } else if (existingAtt.status === 'Absent') {
        existingAtt.status = 'Present'; await existingAtt.save();
        res.json({ success: true, message: "Attendance Marked (Updated from Absent)!" });
    } else {
        res.json({ success: true, message: "Aapki aaj ki attendance pehle hi lag chuki hai." });
    }
});

server.listen(3000, () => console.log("🚀 Server running on Port 3000"));