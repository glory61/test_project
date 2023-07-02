const express = require('express');
const { Patient, Doctor, Appointment } = require('./model.js');
const router = express.Router();
const {connectedClients} = require('./websocketServer');


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
<title>Test task</title>
</head>
<body>
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
  right: -147px;
  top:-58px;
  float: right;
  background-color: #4CAF50;
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
  font-size: 16px;
}


.technique-table {
    background-color: #ffffff;
    width: 50%;
}

.appointment-table {
    background-color: #ffffff;
    width: 50%; /* Updated width to match the technique table */
}
.appointment-card {
  position: relative;
  top: 47%;
  right: -118%;
  transform: translate(50%, -50%);
  outline: 1px solid black;
  padding: 10px
}
 .close-button {
  position: absolute;
  top: 5px;
  right: 5px;
  background-color: #fff;
  border: 1px solid #000;
  padding: 5px 10px;
  cursor: pointer;
}   


</style>
  <div class="tables-container">
    <div class="table-wrapper">

      <table class="technique-table">
        ${techniqueTable}
      </table>
    </div>
    <div class="table-wrapper">
    
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
async function saveData() {
     try {
        const rows = document.getElementsByClassName('appointment-row');
        const idsToBeUpdated = [];
        let newAppointmentTime = '';

        for (const row of rows) {
            if (row.style.backgroundColor === 'blue') {
                const patientId = row.cells[0].textContent;
                const doctorId = row.cells[1].textContent;
                const appointmentTime = row.cells[2].textContent;
console.log('row.style.backgroundColor:', row.style.backgroundColor);

                idsToBeUpdated.push({ patientId, doctorId, appointmentTime });
                if (!newAppointmentTime) {
                    newAppointmentTime = appointmentTime;
                }
            }
        }

        const response = await fetch('/saveData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ appointmentTime: newAppointmentTime, idsToBeUpdated: idsToBeUpdated })
        });

    if (response.ok) {
      const data = await response.json();

      if (data.success) {
        location.reload();
        socket.send('saveData');
      } else {
        throw new Error(data.error);
      }
    } else {
      throw new Error('Network response was not ok');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}


let currentAppointmentCard = null;
async function viewCard(patientId, doctorId, appointmentTime) {
  try {
    const url = '/viewCard?patientId=' + patientId + '&doctorId=' + doctorId + '&appointmentTime=' + encodeURIComponent(appointmentTime);
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      const patient = data.patient;
      const doctor = data.doctor;
      
      if (data.success) {
        // Create the content for the pop-up window
        let content = '';
        content += '<p><strong>Patient ID:</strong> ' + patient.id + '</p>';
        content += '<p><strong>Doctor ID:</strong> ' + doctor.id + '</p>';
        if (doctor.name) {
            content += '<p><strong>Doctor Name:</strong> ' + doctor.name + '</p>';
        }
        if (patient.name) {
            content += '<p><strong>Patient Name:</strong> ' + patient.name + '</p>';
        }
        if (patient.dob) {
            content += '<p><strong>Patient Date of Birth:</strong> ' + patient.dob + '</p>';
        }
        if (doctor.dob) {
            content += '<p><strong>Doctor Date of Birth:</strong> ' + doctor.dob + '</p>';
        }
    
            content += '<p><strong>Appointment Time:</strong> ' + appointmentTime + '</p>';
        
        // Create the appointment card element
       const appointmentCard = document.createElement('div');
       appointmentCard.classList.add('appointment-card');

        const appointmentContent = document.createElement('div');
        appointmentContent.classList.add('appointment-content');
        appointmentContent.innerHTML = content;

        const closeButton = document.createElement('button');
        closeButton.classList.add('close-button');
        closeButton.textContent = 'Close';

       // Add event listener to the close button
       closeButton.addEventListener('click', () => {
       // Remove the appointment card from the DOM
       appointmentCard.remove();
});

appointmentCard.appendChild(appointmentContent);
appointmentCard.appendChild(closeButton);
        // Remove the current appointment card if it exists
        if (currentAppointmentCard) {
          currentAppointmentCard.remove();
        }

        // Position the appointment card in the top-right corner
        const tableWrapper = document.querySelector('.table-wrapper');
        tableWrapper.appendChild(appointmentCard);

        // Update the current appointment card
        currentAppointmentCard = appointmentCard;
      } else {
        console.error('Failed to retrieve appointment data:', data.error);
      }
    } else {
      throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

  function closeButton() {
  
    document.getElementById('closeButton').classList.remove('active');

  
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

router.post('/saveData', async (req, res) => {
    try {
        console.log('Request received: /saveData');

        const idsToBeUpdated = req.body.idsToBeUpdated;
        console.log('IDs to be updated:', idsToBeUpdated);

        for (const idObj of idsToBeUpdated) {
            const { patientId, doctorId, appointmentTime } = idObj;

            const appointment = await Appointment.findOne(
                {
                    patientId,
                    doctorId
                }
            );

            if (appointment) {
                if (appointment.appointmentTime !== Number(appointmentTime)) {
                    appointment.appointmentTime = Number(appointmentTime); // Update the appointment time
                    await appointment.save(); // Save the updated appointment
                    console.log('Appointment found and updated:', appointment);
                } else {
                    console.log('Appointment already has the same time:', appointment);
                }
            } else {
                console.log('Appointment not found for ID:', idObj);
            }
        }
        connectedClients.forEach((client) => {
            client.send('reload');
        });
        console.log('Data saved successfully');

        res.json({ success: true });
    } catch (error) {
        console.error('Error occurred:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});



router.get('/viewCard', async (req, res) => {
    try {
        const patientId = req.query.patientId;
        const doctorId = req.query.doctorId;
        const patient = await Patient.findOne({ id: patientId });
        const doctor = await Doctor.findOne({ id: doctorId });
        if (!patient || !doctor) {
            throw new Error('Patient or Doctor not found');
        }
        res.json({ success: true, patient, doctor });
    } catch (error) {
        res.json({ success: false, error });
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
        const row = `<tr style="background-color: ${rowColor};"><td>${appointment.patientId}</td><td>${appointment.doctorId}</td><td>${appointment.appointmentTime}</td></tr>`;

        table += row;
    }

    table += '</table>';

    return table;
}

async function generateAppointmentTable(appointments) {
    let table = '<table>';
    table += '<tr><th>Patient ID</th><th>Doctor ID</th><th>Time</th><th>Action</th></tr>';
    let greenCount = 0;
    let blueCount = 0;

    for (const appointment of appointments) {
        let rowColor;

        const newTime = await findAvailableTime(appointment, appointments);
        if (newTime !== appointment.appointmentTime) {
            appointment.appointmentTime = newTime;
            rowColor = 'blue';
            blueCount++;
        } else {
            rowColor = 'green';
            greenCount++;
        }

        const row = `<tr class="appointment-row" style="background-color: ${rowColor}">
      <td>${appointment.patientId}</td>
      <td>${appointment.doctorId}</td>
      <td>${appointment.appointmentTime}</td>
      <td><button onclick="viewCard(${appointment.patientId}, ${appointment.doctorId}, '${appointment.appointmentTime}')" class="view-button">View Card</button></td>
    </tr>`;
        table += row;
    }

    table += '</table>';

    const greenAppointments = greenCount === 1 ? 'appointment' : 'appointments';
    const blueAppointments = blueCount === 1 ? 'appointment' : 'appointments';
    table += `<p>${getNumberText(greenCount)} green ${greenAppointments}. ${getNumberText(blueCount)} blue ${blueAppointments}.</p>`;
    table += '<button onclick="saveData()" class="save-button">Save Data</button>';
    return table;
}

async function findAvailableTime(appointment, appointments) {
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
        return appointments.some(
            (a) =>
                a.appointmentTime === time &&
                (a.doctorId === appointment.doctorId || a.patientId === appointment.patientId) &&
                a !== appointment // Exclude the current appointment from the check
        );
    };

    // Find the next available time slot within the working hours
    let newTime = commonWorkingHours.start;

    while (newTime <= commonWorkingHours.end) {
        if (!isConflicting(newTime)) {
            return newTime;
        }
        newTime++;
    }

    // If no available time slot is found, return the original appointment time
    return appointment.appointmentTime;
}




function getNumberText(number) {
    const numberTexts = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    if (number < 10) {
        return numberTexts[number];
    }
    return number;
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
