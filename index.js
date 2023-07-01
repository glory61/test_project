const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const tableRouter = require('./table');
const app = express();
const { Patient, Doctor, Appointment } = require('./model.js');
const WebSocket = require('ws');
const port = 10000;
require('dotenv').config();



// Create WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Store connected clients
const connectedClients = new Set();

wss.on('connection', (ws) => {
    // Add client to connected clients set
    connectedClients.add(ws);
    console.log('A client has connected');
    // Remove client from connected clients set on close event
    ws.on('close', () => {
        connectedClients.delete(ws);
        console.log('A client has disconnected');
    });
});
// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use (tableRouter);
// MongoDB connection setup
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});



// Serve the HTML page with the forms
app.get('/', (req, res) => {
    res.send(`
   <html>
<head>
        </head>
<style>
    body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: Arial, sans-serif;
        background-color: #f5f5f5;
    }

    .form-container {
        background-color: #fff;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }

    .form-container h3 {
        margin-bottom: 10px;
    }

    .form-container textarea {
        width: 100%;
        height: 100px;
        padding: 5px;
        margin-bottom: 10px;
        border: 1px solid #ccc;
        resize: vertical;
    }

   .form-container .button-group {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
    }

    .form-container .button-group button {
         margin-top:-25px;
    }

    .form-container .button-group .clear-button {
        margin-left: auto;
    }
    .form-container .button-group button:last-child {
        align-self: flex-end;
         margin-left: 100px;
         margin-top:-10px;
    }

    .form-container button {
        padding: 10px 20px;
        background-color: #4CAF50;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }

    /* Overlay styles */
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
        visibility: hidden;
        opacity: 0;
        transition: visibility 0s, opacity 0.3s;
    }

    .overlay.active {
        visibility: visible;
        opacity: 1;
    }

    .modal {
        background-color: #fff;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        max-width: 400px;
        text-align: center;
    }

    .modal h3 {
        margin-bottom: 10px;
    }

    .modal p {
        margin-bottom: 20px;
    }

    .modal button {
        padding: 10px 20px;
        background-color: #4CAF50;
        color: #fff;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
</style>
<body>
<div class="form-container">
    <h3>Patients</h3>
    <textarea name="patients" placeholder="Enter patients data"></textarea>

    <h3>Doctors</h3>
    <textarea name="doctors" placeholder="Enter doctors data"></textarea>

    <h3>Appointments</h3>
    <textarea name="appointments" placeholder="Enter appointments data"></textarea>

    <div class="button-group">
        <button type="submit" onclick="submitForm()">Submit Data</button>
        <form action="/cleardb" method="POST">
          <button type="submit" onclick="clearDB(event)" class="clear-button">Clear</button>

        </form>
    </div>
</div>

<div id="overlay" class="overlay">
    <div class="modal">
        <p id="modalMessage"></p>
    </div>
</div>

<script>
    function submitForm() {
        const patientsData = document.querySelector('textarea[name="patients"]').value;
        const doctorsData = document.querySelector('textarea[name="doctors"]').value;
        const appointmentsData = document.querySelector('textarea[name="appointments"]').value;

        // Send the form data to the server using fetch
        fetch('/data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                patients: patientsData,
                doctors: doctorsData,
                appointments: appointmentsData
            })
        })
            .then(response => response.text())
            .then(message => {
                // Display the modal overlay
                document.getElementById('modalMessage').innerHTML = message;
                document.getElementById('overlay').classList.add('active');
                const connectedClients = new Set();
                connectedClients.forEach((client) => {
                    client.send('reload');
                });
            })
            .catch(error => {
                console.error('Error submitting form:', error);
            });
    }
    function closeModal() {
        // Close the modal overlay and clear the form
        document.getElementById('overlay').classList.remove('active');
        document.querySelector('textarea[name="patients"]').value = '';
        document.querySelector('textarea[name="doctors"]').value = '';
        document.querySelector('textarea[name="appointments"]').value = '';
    }
    function clearDB() {
        // Send a request to the server to clear the database
        event.preventDefault();
        fetch('/cleardb', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.text())
            .then(message => {
                // Display the modal overlay
                document.getElementById('modalMessage').innerHTML = message;
                document.getElementById('overlay').classList.add('active');
                connectedClients.forEach((client) => {
                    client.send('reload');
                });
            })
            .catch(error => {
                console.error('Error clearing database:', error);
            });
    }
    

</script>
</body>
</html>

  `);
});


// Endpoint for submitting all data
app.post('/data', async (req, res) => {
    const patientsData = req.body.patients;
    const doctorsData = req.body.doctors;
    const appointmentsData = req.body.appointments;

    let successfulPatients = [];
    let successfulDoctors = [];

    let failedFormatPatients = [];
    let failedFormatDoctors = [];
    let failedFormatAppointments = [];
    let duplicatePatients = [];
    let duplicateDoctors = [];
    let duplicateAppointments = [];

    // Process patients
    const patientsArray = patientsData.split('\n').map((line) => line.trim());
    for (const patientLine of patientsArray) {
        const patientData = patientLine.split(',').map((item) => item.trim());
        const id = Number.parseInt(patientData[0]);
        let hours,name,dob = undefined;


        // Validate data format here
        const hoursPattern = /^([7-9]|1[0-9]|2[0-4])(?:-([7-9]|1[0-9]|2[0-4]))?$/;
        const namePattern = /^[A-Za-z]+(?:\s[A-Za-z]+)*$/;
        const dobPattern = /^\d{2}\.\d{2}\.\d{4}$/;
        //check for name/dob
        if (!(isNaN(id) || !hoursPattern.test(patientData[1]))) {
            if (patientData.length > 2 && namePattern.test(patientData[2])) {
                name = patientData[2];
            }

            if (patientData.length > 3 && dobPattern.test(patientData[3])) {
                dob = patientData[3];
            } else if (patientData.length > 2 && dobPattern.test(patientData[2])) {
                dob = patientData[2];
            }

            // Extract hours from the patientData
            const hoursMatch = patientData[1].match(hoursPattern);
            if (hoursMatch) {
                hours = hoursMatch[0];
            }

            const patient = new Patient({
                id,
                hours,
                name,
                dob
            });

            try {
                const existingPatient = await Patient.findOne({ id });
                if (existingPatient) {
                    duplicatePatients.push(patientLine);
                    continue;
                }

                await patient.save();
                successfulPatients.push(patientLine);
            } catch (error) {
                console.error('Error saving patient:', error);
            }
        } else {
            failedFormatPatients.push(patientLine);
        }

    }


    // Process doctors
    const doctorsArray = doctorsData.split('\n').map((line) => line.trim());

    for (const doctorLine of doctorsArray) {
        const doctorData = doctorLine.split(',').map((item) => item.trim());
        const id = Number.parseInt(doctorData[0]);
        let hours,name,dob = undefined;


        // Validate data format here
        const hoursPattern = /^([7-9]|1[0-9]|2[0-4])(?:-([7-9]|1[0-9]|2[0-4]))?$/;
        const namePattern = /^[A-Za-z]+(?:\s[A-Za-z]+)*$/;
        const dobPattern = /^\d{2}\.\d{2}\.\d{4}$/;
        //check for name/dob
        if (!(isNaN(id) || !hoursPattern.test(doctorData[1]))) {
            if (doctorData.length > 2 && namePattern.test(doctorData[2])) {
                name = doctorData[2];
            }


            if (doctorData.length > 3 && dobPattern.test(doctorData[3])) {
                dob = doctorData[3];
            } else if (doctorData.length > 2 && dobPattern.test(doctorData[2])) {
                dob = doctorData[2];
            }

            // Extract hours from the doctorData
            const hoursMatch = doctorData[1].match(hoursPattern);
            if (hoursMatch) {
                hours = hoursMatch[0];
            }

            const doctor = new Doctor({
                id,
                hours,
                name,
                dob
            });

            try {
                const existingDoctor = await Doctor.findOne({ id });
                if (existingDoctor) {
                    duplicateDoctors.push(doctorLine);
                    continue;
                }

                await doctor.save();
                successfulDoctors.push(doctorLine);
            } catch (error) {
                console.error('Error saving patient:', error);
            }
        } else {
            failedFormatDoctors.push(doctorLine);
        }
    }

    // Process appointments
    const appointmentsArray = appointmentsData.split('\n').map((line) => line.trim());

    for (const appointmentLine of appointmentsArray) {
        const appointmentData = appointmentLine.split(',').map((item) => item.trim());
        const patientId = Number.parseInt(appointmentData[0]);
        const doctorId = Number.parseInt(appointmentData[1]);
        const appointmentTime = Number.parseInt(appointmentData[2]);

        try {
            // Validate data format here
            if (isNaN(patientId) || isNaN(doctorId)) {
                failedFormatAppointments.push(appointmentLine);
                continue;
            }

            // Check if patient or doctor exists
            const existingPatient = await Patient.findOne({ id: patientId });
            const existingDoctor = await Doctor.findOne({ id: doctorId });
            if (!existingPatient ||!existingDoctor) {
                failedFormatAppointments.push(appointmentLine);
                continue;
            }

            const appointment = new Appointment({
                patientId,
                doctorId,
                appointmentTime: appointmentTime || 0,
            });

            await appointment.save();
        } catch (error) {
           console.error('Error saving appointment:', error);
        }
    }



    let message = '';
    if (successfulPatients.length > 0) {
        message += `<b>Successful Patients:</b><br>${successfulPatients.join('<br>')}`;
    }
    if (successfulDoctors.length > 0) {
        message += `<b><br><br>Successful Doctors:</b><br>${successfulDoctors.join('<br>')}`;
    }
    if (duplicatePatients.length > 0) {
        message += `<b><br><br>Duplicate Patients:</b><br>${duplicatePatients.join('<br>')}`;
    }
    if (duplicateDoctors.length > 0) {
        message += `<b><br><br>Duplicate Doctors:</b><br>${duplicateDoctors.join('<br>')}`;
    }
    if (duplicateAppointments.length > 0) {
        message += `<b><br><br>Duplicate Appointments:</b><br>${duplicateAppointments.join('<br>')}`;
    }
    if (Array.isArray(failedFormatPatients) && failedFormatPatients.filter(e => e).length > 0) {
        message += `<b><br><br>Wrong format Patiens:</b><br>${failedFormatPatients.join('<br>')}`;
    }
    if (Array.isArray(failedFormatDoctors) && failedFormatDoctors.filter(e => e).length > 0) {
        message += `<b><br><br>Wrong format Doctors:</b><br>${failedFormatDoctors.join('<br>')}`;
    }
    if (Array.isArray(failedFormatAppointments) && failedFormatAppointments.filter(e => e).length > 0) {
        message += `<b><br><br>Wrong format Appointments:</b><br>${failedFormatAppointments.join('<br>')}`;
    }

    if (message !== '') {
        message += '<br><br>';
    }




    res.setHeader('Content-Type', 'text/html'); // Set the content type to HTML
    res.send(`<html>
        <h3><b>Data Submitted</b></h3>
        <p>${message}</p>
       <button onclick="closeModal()">Close</button>
         </html> `);connectedClients.forEach((client) => {
        client.send('reload');
    });
});


// Endpoint for clearing the database
app.post('/cleardb', async (req, res) => {
    try {
        const patientsDeleteCount = await Patient.deleteMany();
        const doctorsDeleteCount = await Doctor.deleteMany();
        const appointmentsDeleteCount = await Appointment.deleteMany();

        res.send(`<html>
      Patients deleted: ${patientsDeleteCount.deletedCount}<br>
      Doctors deleted: ${doctorsDeleteCount.deletedCount}<br>
      Appointments deleted: ${appointmentsDeleteCount.deletedCount}<br><br>
       <button onclick="closeModal()">Close</button>
        </html> `);
        connectedClients.forEach((client) => {
            client.send('reload');
        });
    } catch (error) {
        console.error('Error clearing database:', error);
        res.send('Failed to clear the database');
    }
});


// Start the server
const server = app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});
server.on('upgrade', handleUpgrade);
function handleUpgrade(request, socket, head) {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
}



// Export models
module.exports = {
    Patient,
    Doctor,
    Appointment
};

