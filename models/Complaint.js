const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    building: { type: String, required: true },
    floor: { type: String, required: true },
    roomNo: { type: String, required: true },
    type: { type: String, required: true }, // Electrical, Furniture, Plumbing, Other
    notes: { type: String },
    photoBase64: { type: String, required: true }, // Image storage
    status: { type: String, default: 'Pending' }, // Pending ya Resolved
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);