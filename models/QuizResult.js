const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    studentId: { type: String, required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    tabSwitches: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    // NAYA: Student ne kis question ka kya answer diya wo save karna
    answers: [{
        questionIndex: Number, 
        selectedOption: Number // -1 agar skip kiya ho toh
    }],
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('QuizResult', resultSchema);