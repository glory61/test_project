const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    hours: { type: String, required: true },
    name: { type: String },
    dob: { type: String, alias: 'dateOfBirth' }
});

const doctorSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    hours: { type: String, required: true },
    name: { type: String },
    dob: { type: String }
});

const appointmentSchema = new mongoose.Schema({
    patientId: { type: Number, required: true },
    doctorId: { type: Number, required: true },
    appointmentTime: { type: Number },
});



const Patient = mongoose.model('Patient', patientSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);


module.exports = { Patient, Doctor, Appointment };
