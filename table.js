const express = require('express');
const { Patient, Doctor, Appointment } = require('./model.js');
const router = express.Router();

router.get('/table', async (req, res) => {
    try {
        const [patients, doctors, appointments] = await Promise.all([
            Patient.find(),
            Doctor.find(),
            Appointment.find()
        ]);

        const techniqueTable = generateTechniqueTable(appointments, patients, doctors);
        const appointmentTable = await generateAppointmentTable(appointments);

        const html = `
      <html>
        <head>
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
              border: 2px solid black;
              width: 150%;
            }

            table td, table th {
              padding: 8px;
            }

            table tr:nth-child(even) {
              background-color: #f2f2f2;
              border: 2px solid black;
            }

            table th {
              text-align: left;
              background-color: #4CAF50;
              color: white;
            }

            .save-button {
              position: relative;
              right: -140px;
              top: -57px;
              float: right;
              background-color: #4CAF50;
              color: white;
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              margin-top: 10px;
            }

            .appointment-row td button {
              background-color: #a2a2a2;
              color: #000000;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }

            .technique-table {
              background-color: #ffffff;
              width: 50%;
            }

            .appointment-table {
              background-color: #ffffff;
              width: 50%;
            }
          </style>
        </head>
        <body>
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
                ${appointmentTable}
              </table>
              <button onclick="saveData()" class="save-button">Save Data</button>
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

            async function saveData() {
              const appointments = await Appointment.find({ color: 'blue' });

              for (const appointment of appointments) {
                const previousAppointment = await Appointment.findOne({ _id: appointment._id });

                if (previousAppointment.appointmentTime !== appointment.appointmentTime) {
                  appointment.color = 'blue';
                  await appointment.save();
                }
              }

              location.reload();
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

    table += '<tr><th>Patient ID</th><th>Doctor ID</th><th>Time</th></tr>';

    for (const appointment of appointments) {
        const patient = patients.find((p) => p.id === appointment.patientId);
        const doctor = doctors.find((d) => d.id === appointment.doctorId);

        const isPossible = isAppointmentPossible(appointment, patient, doctor, appointments);
        const isConflicting = isAppointmentConflicting(appointment, appointments);
        const isImpossible = isAppointmentImpossible(appointment);

        let rowColor = '';
        if (isPossible && !isConflicting && !isImpossible) {
            rowColor = 'green';
        } else if (!isPossible) {
            rowColor = 'red';
        } else {
            rowColor = 'yellow';
        }

        const row = `<tr style="background-color: ${rowColor};">
      <td>${appointment.patientId}</td>
      <td>${appointment.doctorId}</td>
      <td>${appointment.appointmentTime}</td>
    </tr>`;

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
        const newTime = await findAvailableTime(appointment, sortedAppointments);

        if (newTime !== appointment.appointmentTime) {
            appointment.appointmentTime = newTime;
            appointmentCounts[appointment.doctorId] = (appointmentCounts[appointment.doctorId] || 0) + 1;
            rowColor = 'blue';
        } else {
            rowColor = 'green';
        }

        const row = `<tr class="appointment-row" style="background-color: ${rowColor}">
      <td>${appointment.patientId}</td>
      <td>${appointment.doctorId}</td>
      <td>${appointment.appointmentTime}</td>
      <td><button onclick="viewCard('${appointment.patientId}', '${appointment.doctorId}', '${appointment.appointmentTime}')">View Card</button></td>
    </tr>`;

        table += row;
    }

    table += '</table>';

    const greenCount = Object.values(appointmentCounts).filter((count) => count >= 1).reduce((acc, count) => acc + count, 0);
    const blueCount = Object.values(appointmentCounts).filter((count) => count > 1).reduce((acc, count) => acc + count, 0);

    const greenAppointments = greenCount === 1 ? 'appointment' : 'appointments';
    const blueAppointments = blueCount === 1 ? 'appointment' : 'appointments';

    table += `<p>${getNumberText(greenCount)} green ${greenAppointments}. ${getNumberText(blueCount)} blue ${blueAppointments}.</p>`;

    return table;
}

async function findAvailableTime(appointment, sortedAppointments) {
    const doctor = await Doctor.findOne({ id: appointment.doctorId });
    const patient = await Patient.findOne({ id: appointment.patientId });

    const doctorWorkingHours = doctor.hours.split('-').map(Number);
    const patientWorkingHours = patient.hours.split('-').map(Number);

    const commonWorkingHours = {
        start: Math.max(doctorWorkingHours[0], patientWorkingHours[0]),
        end: Math.min(doctorWorkingHours[1], patientWorkingHours[1])
    };

    const isConflicting = (time) => {
        return sortedAppointments.some(a => a.appointmentTime === time &&
            (a.doctorId === appointment.doctorId || a.patientId === appointment.patientId));
    };

    if (isConflicting(appointment.appointmentTime)) {
        let newTime = commonWorkingHours.start;

        while (newTime <= commonWorkingHours.end) {
            if (!isConflicting(newTime)) {
                return newTime;
            }
            newTime++;
        }

        newTime = commonWorkingHours.end;
        while (newTime >= commonWorkingHours.start) {
            if (!isConflicting(newTime)) {
                return newTime;
            }
            newTime--;
        }
    }

    return appointment.appointmentTime;
}

function getNumberText(number) {
    const numberTexts = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    if (number < 10) {
        return numberTexts[number];
    }
    return number;
}

function viewCard(patientId, doctorId, appointmentTime) {
    const patient = Patient.find();
    const doctor = Doctor.find();

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
