const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const tableRouter = require('./table');
const app = express();
const { Patient, Doctor, Appointment } = require('./model.js');
const port = 10000;
const {connectedClients,handleUpgrade } = require('./websocketServer');
require('dotenv').config();



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
<title>Test task</title>
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
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
            background-color: #fff;
            padding: 40px;
            width:877px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            position: relative;
        }

        .form-container > div {
            margin: 10px;
            flex-basis: calc(33.33% - 20px);
        }

        .form-container h3 {
            margin-bottom: 10px;
        }

        .form-container textarea {
            width: 100%;
            height: 350px;
            padding: 5px;
            margin-bottom: 10px;
            border: 1px solid #ccc;
            resize: vertical;
        }

        .form-container .button-group {
  display: flex;
  justify-content: flex-end;
  position: absolute;
  bottom: 1px;
  left: -19px;
  width: calc(100% - 40px);
}

        .form-container .button-group button {
        margin-left: 10px;
     }

        .form-container button {
            margin-top: 10px;
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
</head>



<body>
<div class="form-container">
    <div>
        <h3>Patients</h3>
        <textarea name="patients" placeholder="Enter patients data"></textarea>
    </div>

    <div>
        <h3>Doctors</h3>
        <textarea name="doctors" placeholder="Enter doctors data"></textarea>
    </div>

    <div>
        <h3>Appointments</h3>
        <textarea name="appointments" placeholder="Enter appointments data"></textarea>
    </div>

    <div class="button-group">
        <button type="submit" onclick="submitForm()">Send Data</button>
            <button type="submit" onclick="clearDB(event)" class="clear-button">Clear DB</button>
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
           
               
            })
            .catch(error => {
                console.error('Error submitting form:', error);
            });
    }

   function closeModal() {
    // Close the modal overlay
    document.getElementById('overlay').classList.remove('active');

    // Check if the overlay does not have the 'cleardb' class
    if (!document.getElementById('overlay').classList.contains('cleardb')) {
        // Clear the form fields
        document.querySelector('textarea[name="patients"]').value = '';
        document.querySelector('textarea[name="doctors"]').value = '';
        document.querySelector('textarea[name="appointments"]').value = '';
    }
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
               document.getElementById('overlay').classList.add('active', 'cleardb');

               
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
let isSubmitting = false;
app.post('/data', async (req, res) => {

    if (isSubmitting) {
        // If a submission is already in progress, return a response indicating it
        return res.send('A submission is already in progress. Please wait.');
    }

    isSubmitting = true;
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
        let hours, name, dob = undefined;

        const hoursPattern = /^(?:[89]|1[0-9]|2[0-4])(?:-(?:[89]|1[0-9]|2[0-4]))$/;
        const namePattern = /^([A-Za-z]+(\s[A-Za-z]+)?)$/;
        const dobPattern = /^\d{2}\.\d{2}\.\d{4}$/;

        console.log(`Processing patient: ${patientLine}`);

        if (!(isNaN(id) || !hoursPattern.test(patientData[1]))) {
            if (patientData.length > 2) {
                let splitName = patientData[2].split(' ');
                if (splitName.length > 2 || (!namePattern.test(patientData[2]) && !dobPattern.test(patientData[2]))) {
                    console.log(`Name or Date of Birth is in wrong format: ${patientData[2]}`);
                    failedFormatPatients.push(patientLine);
                    continue;
                }
                if (namePattern.test(patientData[2])) {
                    name = patientData[2];
                }
                if (dobPattern.test(patientData[2])) {
                    dob = patientData[2];
                }
            }
            if (patientData.length > 3) {
                if (!dobPattern.test(patientData[3])) {
                    console.log(`Date of Birth is in wrong format: ${patientData[3]}`);
                    failedFormatPatients.push(patientLine);
                    continue;
                }
                dob = patientData[3];
            }

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
                    console.log(`Duplicate patient found with id: ${id}`);
                    duplicatePatients.push(patientLine);
                    continue;
                }


                console.log(`Saving patient with id: ${id}`);
                await patient.save();
                successfulPatients.push(patientLine);
            } catch (error) {
                console.error('Error saving patient:', error);
            }
        } else {
            console.log(`Patient with id: ${id} has wrong format`);
            failedFormatPatients.push(patientLine);
        }
    }



    // Process doctors
    const doctorsArray = doctorsData.split('\n').map((line) => line.trim());

    for (const doctorLine of doctorsArray) {
        const doctorData = doctorLine.split(',').map((item) => item.trim());
        const id = Number.parseInt(doctorData[0]);
        let hours, name, dob = undefined;

        const hoursPattern = /^(?:[89]|1[0-9]|2[0-4])(?:-(?:[89]|1[0-9]|2[0-4]))$/;
        const namePattern = /^([A-Za-z]+(\s[A-Za-z]+)?)$/;
        const dobPattern = /^\d{2}\.\d{2}\.\d{4}$/;

        console.log(`Processing doctor: ${doctorLine}`);

        if (!(isNaN(id) || !hoursPattern.test(doctorData[1]))) {
            if (doctorData.length > 2) {
                let splitName = doctorData[2].split(' ');
                if (splitName.length > 2 || (!namePattern.test(doctorData[2]) && !dobPattern.test(doctorData[2]))) {
                    console.log(`Name or Date of Birth is in wrong format: ${doctorData[2]}`);
                    failedFormatDoctors.push(doctorLine);
                    continue;
                }
                if (namePattern.test(doctorData[2])) {
                    name = doctorData[2];
                }
                if (dobPattern.test(doctorData[2])) {
                    dob = doctorData[2];
                }
            }
            if (doctorData.length > 3) {
                if (!dobPattern.test(doctorData[3])) {
                    failedFormatDoctors.push(doctorLine);
                    continue;
                }
                dob = doctorData[3];
            }

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
                    console.log(`Duplicate doctor found with id: ${id}`);
                    duplicateDoctors.push(doctorLine);
                    continue;
                }


                console.log(`Saving doctor with id: ${id}`);
                await doctor.save();
                successfulDoctors.push(doctorLine);
            } catch (error) {
                console.error('Error saving doctor:', error);
            }
        } else {
            failedFormatDoctors.push(doctorLine);
        }
    }

    // Process appointments
    const appointmentsArray = appointmentsData.split('\n').map((line) => line.trim());

    for (const appointmentLine of appointmentsArray) {
        const appointmentData = appointmentLine.split(',').map((item) => item.trim());

        // Validate data format here
        if (appointmentData.length !== 3) {
            failedFormatAppointments.push(appointmentLine);
            continue;
        }

        const patientId = Number.parseInt(appointmentData[0]);
        const doctorId = Number.parseInt(appointmentData[1]);
        const appointmentTime = Number.parseInt(appointmentData[2]);

        try {

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

    function addSection(title, items) {
        if (Array.isArray(items) && items.filter(e => e).length > 0) {
            message += `<b>${title}:</b><br>${items.join('<br>')}`;
        }
    }

    addSection('Successful Patients', successfulPatients);
    addSection('<br><br>Successful Doctors', successfulDoctors);
    addSection('<br><br>Wrong format Patients', failedFormatPatients);
    addSection('<br><br>Wrong format Doctors', failedFormatDoctors);
    addSection('<br><br>Wrong format Appointments', failedFormatAppointments);
    addSection('<br><br>Duplicate Patients', duplicatePatients);
    addSection('<br><br>Duplicate Doctors', duplicateDoctors);
    addSection('<br><br>Duplicate Appointments', duplicateAppointments);

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
    isSubmitting = false;
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

app.put('/api/appointments/update', async (req, res) => {
    const { color, patientId, doctorId, appointmentTime } = req.body;
    try {
        const appointment = await Appointment.findOne({ patientId, doctorId, appointmentTime });
        if (!appointment) {
            return res.status(404).send('Appointment not found');
        }
        appointment.color = color;
        await appointment.save();
        res.status(200).send('Appointment updated');
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.get('/api/appointments/:patientId/:doctorId/:appointmentTime', async (req, res) => {
    const { patientId, doctorId, appointmentTime } = req.params;
    try {
        const appointment = await Appointment.findOne({ patientId, doctorId, appointmentTime });
        if (!appointment) {
            return res.status(404).send('Appointment not found');
        }
        res.status(200).json(appointment);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
// Start the server
const server = app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});
server.on('upgrade', handleUpgrade);






// Export models
module.exports = {
    Patient,
    Doctor,
    Appointment
};

