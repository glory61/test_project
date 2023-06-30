const express = require('express');
const { Patient, Doctor, Appointment } = require('./model.js');
const router = express.Router();



router.get('/table', async (req, res) => {
    try {
        const patients = await Patient.find();
        const doctors = await Doctor.find();
        const appointments = await Appointment.find();
        const techniqueTable = generateTechniqueTable(appointments, patients, doctors);
        const appointmentTable = generateAppointmentTable(appointments);
        const html = `
<html>
<head>
</head>
<body>
<style>body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: Arial, sans-serif;
    background-color: #f5f5f5;
}

h2 {
    margin-bottom: 10px;
}

.tables-container {
    display: flex;
    justify-content: center;
    max-width: 1000px;
}

.table-wrapper {
    flex: 1;
    margin: 100px;
    width: 50%;
}

table {
    border-collapse: collapse;
    width: 150%;
}

table td, table th {
    padding: 8px;
}

table tr:nth-child(even) {
    background-color: #f2f2f2;
}

table th {
    text-align: left;
    background-color: #4CAF50;
    color: white;
}

.technique-table {
    background-color: #ffffff;
    width: 50%;
}

.appointment-table {
    background-color: #ffffff;
    width: 50%; /* Updated width to match the technique table */
}
</style>
  <div class="tables-container">
    <div class="table-wrapper">
      <h2>Technique Table</h2>
      <table class="technique-table">
        ${techniqueTable}
      </table>
    </div>
    <div class="table-wrapper">
      <h2>Appointment Table</h2>
      <table class="appointment-table">
        ${await appointmentTable}
      </table>
    </div>
  </div>
  <script>
    const socket = new WebSocket((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host);
    socket.onerror = function (error) {
  console.log('WebSocket Error: ', error);
};

socket.onopen = function (event) {
  console.log('WebSocket is open now.');
};

socket.onclose = function (event) {
  console.log('WebSocket is closed now.');
};

    socket.onmessage = function (event) {
      if (event.data === 'reload') {
        location.reload(); // Reload the page
      }
    };
    // Save Data function for front-end
    function saveData() {
      socket.send('saveData');
    }
  </script>
</body>
</html>
   `;
        res.send(html);
    } catch (error) {
        console.error('Error retrieving data:', error);
        res.send('Failed to retrieve data');
    }
});

function generateTechniqueTable(appointments, patients, doctors) {
    let table = '<table>';

    // Add table headers
    table += '<tr><th>Patient ID</th><th>Doctor ID</th><th>Time</th></tr>';

    // Iterate over appointments
    for (const appointment of appointments) {
        const patient = patients.find((p) => p.id === appointment.patientId);
        const doctor = doctors.find((d) => d.id === appointment.doctorId);

        // Check if the appointment is possible, conflicting, or impossible
        let isPossible = isAppointmentPossible(appointment, patient, doctor, appointments);
        if (appointment.appointmentTime !== undefined) {
            isPossible = isAppointmentPossible(appointment, patient, doctor, appointments);
        }
        const isConflicting = isAppointmentConflicting(appointment, appointments); // pass the full list of appointments
        const isImpossible = isAppointmentImpossible(appointment);

        // Determine the appropriate background color based on appointment status
        let rowColor = '';
        if (isPossible && !isConflicting && !isImpossible) {
            rowColor = 'green';
        } else if (!isPossible) {
            rowColor = 'red';
        } else {
            rowColor = 'yellow';
        }



        // Generate table row with appropriate background color
        const row = `<tr style="background-color: ${rowColor}"><td>${appointment.patientId}</td><td>${appointment.doctorId}</td><td>${appointment.appointmentTime}</td></tr>`;

        table += row;
    }

    table += '</table>';

    return table;
}

async function generateAppointmentTable(appointments) {
    let table = '<table>';

    table += '<tr><th>Patient ID</th><th>Doctor ID</th><th>Time</th><th>Action</th></tr>';

    const sortedAppointments = sortAppointments(appointments);
    const appointmentCounts = {};

    for (const appointment of sortedAppointments) {
        // Find an available time for the appointment
        const newTime = await findAvailableTime(appointment, sortedAppointments);
        // If the available time differs from the original appointment time,
        // update the appointment time and set the row color to blue
        if (newTime !== appointment.appointmentTime) {
            appointment.appointmentTime = newTime;
            appointmentCounts[appointment.doctorId] = (appointmentCounts[appointment.doctorId] || 0) + 1;
            rowColor = 'blue'; // Set row color to blue when the appointment time has moved
        } else {
            // Else if the appointment does not conflict, set the row color to green
            rowColor = 'green';
        }

        const row = `<tr style="background-color: ${rowColor}"><td>${appointment.patientId}</td><td>${appointment.doctorId}</td><td>${appointment.appointmentTime}</td><td><button onclick="viewCard(${appointment.patientId}, ${appointment.doctorId}, ${appointment.appointmentTime})">View Card</button></td></tr>`;
        table += row;

    }

    table += '</table>';

    const greenCount = Object.values(appointmentCounts).filter((count) => count >= 1).length;
    const blueCount = Object.values(appointmentCounts).filter((count) => count > 1).length;

    const greenAppointments = greenCount === 1 ? 'appointment' : 'appointments';
    const blueAppointments = blueCount === 1 ? 'appointment' : 'appointments';

    table += `<p>${getNumberText(greenCount)} green ${greenAppointments}. ${getNumberText(blueCount)} blue ${blueAppointments}.</p>`;
    table += '<button onclick="saveData()">Save Data</button>';

    return table;
}

async function findAvailableTime(appointment, sortedAppointments) {
    // Fetch the doctor and patient from the database
    const doctor = await Doctor.findOne({ id: appointment.doctorId });
    const patient = await Patient.findOne({ id: appointment.patientId });

    // Parse the working hours
    const doctorWorkingHours = doctor.hours.split('-').map(Number);
    const patientWorkingHours = patient.hours.split('-').map(Number);

    // Determine the common working hours range
    const commonWorkingHours = {
        start: Math.max(doctorWorkingHours[0], patientWorkingHours[0]),
        end: Math.min(doctorWorkingHours[1], patientWorkingHours[1]),
    };

    // Function to check if a time conflicts with any other appointments
    const isConflicting = (time) => {
        return sortedAppointments.some(a => a.appointmentTime === time &&
            (a.doctorId === appointment.doctorId || a.patientId === appointment.patientId));
    };

    // If the appointment time is conflicting, find a new time slot
    if (isConflicting(appointment.appointmentTime)) {
        let newTime = commonWorkingHours.start;

        // Try to find a time slot moving forward within the working hours
        while (newTime <= commonWorkingHours.end) {
            if (!isConflicting(newTime)) {
                return newTime;
            }
            newTime++;
        }

        // If no time slot is found, try to find a time slot moving backward within the working hours
        newTime = commonWorkingHours.end;
        while (newTime >= commonWorkingHours.start) {
            if (!isConflicting(newTime)) {
                return newTime;
            }
            newTime--;
        }
    }

    // If the appointment time is not conflicting, keep it unchanged
    return appointment.appointmentTime;
}













function getNumberText(number) {
    const numberTexts = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    if (number < 10) {
        return numberTexts[number];
    }
    return number;
}

async function saveData() {
    const appointments = await Appointment.find({ color: 'blue' });
    appointments.forEach(async (appointment) => {
        const previousAppointment = await Appointment.findOne({ _id: appointment._id });
        if (previousAppointment.appointmentTime !== appointment.appointmentTime) {
            appointment.color = 'blue';
            await appointment.save();
        }
    });
    location.reload();
}


function viewCard(patientId, doctorId, appointmentTime) {
    // Retrieve the detailed information about the appointment
    const patient = Patient.find();
    const doctor = Doctor.find();

    // Create the content for the pop-up window
    let content = `<h2>Appointment Details</h2>`;
    content += `<p><strong>Patient ID:</strong> ${patientId}</p>`;
    content += `<p><strong>Doctor ID:</strong> ${doctorId}</p>`;
    content += `<p><strong>Patient Name:</strong> ${patient.name}</p>`;
    content += `<p><strong>Doctor Name:</strong> ${doctor.name}</p>`;
    if (patient.dob) {
        content += `<p><strong>Patient Date of Birth:</strong> ${patient.dob}</p>`;
    }
    if (appointmentTime) {
        content += `<p><strong>Appointment Time:</strong> ${appointmentTime}</p>`;
    }

    // Create the pop-up window
    const popup = window.open('', 'Appointment Card', 'width=400,height=300');
    popup.document.write(content);
    popup.document.close();
}





function sortAppointments(appointments) {
    return appointments.sort((a, b) => {
        if (a.patientId !== b.patientId) {
            return a.patientId - b.patientId;
        } else if (a.doctorId !== b.doctorId) {
            return a.doctorId - b.doctorId;
        } else {
            return a.appointmentTime - b.appointmentTime;
        }
    });
}


function isAppointmentPossible(appointment, patient, doctor) {
    const doctorAvailability = doctor.hours.split('-').map(Number);
    const patientAvailability = patient.hours.split('-').map(Number);
    const isDoctorAvailable = appointment.appointmentTime >= doctorAvailability[0] && appointment.appointmentTime < doctorAvailability[1];
    const isPatientAvailable = appointment.appointmentTime >= patientAvailability[0] && appointment.appointmentTime < patientAvailability[1];
    return isDoctorAvailable && isPatientAvailable;
}


function isAppointmentConflicting(appointment, appointments) {
    const patientAppointments = appointments.filter(a => a.patientId === appointment.patientId && a.appointmentTime === appointment.appointmentTime);
    const doctorAppointments = appointments.filter(a => a.doctorId === appointment.doctorId && a.appointmentTime === appointment.appointmentTime);
    return patientAppointments.length > 1 || doctorAppointments.length > 1;
}




function isAppointmentImpossible(appointment) {
    return appointment.appointmentTime === undefined;
}




module.exports = router;
