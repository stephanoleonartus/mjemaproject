// --- Mocking Browser Environment & HTML Elements ---
global.document = {
    getElementById: function(id) {
        // console.log(`Mock getElementById for: ${id}`);
        if (!global.mockDOMStore) global.mockDOMStore = {};
        if (!global.mockDOMStore[id]) {
            global.mockDOMStore[id] = {
                value: '',
                innerHTML: '',
                textContent: '',
                style: {},
                classList: {
                    add: (cn) => {
                        if(!global.mockDOMStore[id].classListStore) global.mockDOMStore[id].classListStore = new Set();
                        global.mockDOMStore[id].classListStore.add(cn);
                    },
                    remove: (cn) => {
                        if(!global.mockDOMStore[id].classListStore) global.mockDOMStore[id].classListStore = new Set();
                        global.mockDOMStore[id].classListStore.delete(cn);
                    },
                    contains: (cn) => {
                        if(!global.mockDOMStore[id].classListStore) global.mockDOMStore[id].classListStore = new Set();
                        return global.mockDOMStore[id].classListStore.has(cn);
                    }
                },
                addEventListener: () => {},
                reset: () => {
                    if(global.mockDOMStore[id].value !== undefined) global.mockDOMStore[id].value = '';
                },
                appendChild: () => {},
                querySelector: () => null, // Mock querySelector
                querySelectorAll: () => [], // Mock querySelectorAll
                children: [],
                options: [],
                selectedOptions: [],
                disabled: false, // Add disabled property
                // Specific for form elements to track their values
                _value: '',
                get value() { return this._value; },
                set value(val) { this._value = val; }
            };
        }
        return global.mockDOMStore[id];
    },
    createElement: (type) => {
        // console.log(`Mock createElement for: ${type}`);
        return {
            innerHTML: '',
            appendChild: () => {},
            classList: { add: () => {} },
            setAttribute: () => {}
        };
    },
    querySelectorAll: () => [], // Mock querySelectorAll at document level
    addEventListener: () => {}, // Mock addEventListener at document level
};

global.navigator = {
    geolocation: {
        getCurrentPosition: (successCb, errorCb, options) => {
            // console.log("Mock getCurrentPosition called");
            if (global.mockLocation) {
                // console.log("Using mockLocation:", global.mockLocation);
                successCb({ coords: global.mockLocation });
            } else {
                // console.log("Error: mockLocation not set for test.");
                errorCb({ code: 2, message: "Location not available for mock." });
            }
        }
    }
};

global.alert = (message) => {
    // console.log("Alert:", message); // Suppress alerts or log them
    global.lastAlert = message;
};

global.confirm = (message) => {
    // console.log("Confirm:", message);
    return true; // Assume user confirms for tests
};

global.localStorage = { // Mock localStorage if needed
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

// --- Extracted JavaScript from smartAttendance.html (essential parts) ---
let currentUser = null;
let currentLocation = null; // Variable to store current location object
let attendanceData = [];
let employees = [
    { id: 'emp001', name: 'John Doe', email: 'john@company.com', department: 'IT', password: 'password123', role: 'employee' },
    { id: 'admin', name: 'Administrator', email: 'admin@company.com', department: 'Admin', password: 'admin123', role: 'admin' }
];
let geofenceConfig = { name: 'Main Office', centerLat: -6.7924, centerLng: 39.2083, radius: 100 };
const workHours = { start: '08:00', end: '17:00' };
let lastAlert = null; // To capture alert messages

// Helper to reset state for tests
function resetState() {
    currentUser = null;
    currentLocation = null;
    attendanceData = []; // Clear attendance data for each test case
    lastAlert = null;

    // Reset mock DOM values that are read or written to by the functions
    if (global.mockDOMStore) {
        if (global.mockDOMStore['statusText']) global.mockDOMStore['statusText'].textContent = 'Ready to Check In';
        if (global.mockDOMStore['lastAction']) global.mockDOMStore['lastAction'].textContent = 'No check-in recorded today';
        if (global.mockDOMStore['statusCard']) global.mockDOMStore['statusCard'].className = 'status-card';
        if (global.mockDOMStore['checkInBtn']) global.mockDOMStore['checkInBtn'].disabled = false;
        if (global.mockDOMStore['checkOutBtn']) global.mockDOMStore['checkOutBtn'].disabled = true;
        if (global.mockDOMStore['locationText']) global.mockDOMStore['locationText'].innerHTML = 'Detecting location...';
        if (global.mockDOMStore['coordinates']) global.mockDOMStore['coordinates'].textContent = '';
        if (global.mockDOMStore['attendanceHistory']) global.mockDOMStore['attendanceHistory'].innerHTML = '';
        if (global.mockDOMStore['employeeId']) global.mockDOMStore['employeeId'].value = '';
        if (global.mockDOMStore['password']) global.mockDOMStore['password'].value = '';
        if (global.mockDOMStore['role']) global.mockDOMStore['role'].value = 'employee';
    }
}


function showAlert(message, type, containerId = 'alertContainer') {
    // console.log(`ShowAlert (${type}, ${containerId}): ${message}`);
    lastAlert = message;
}

function handleLogin(e) { // Made it synchronous for easier testing
    if(e) e.preventDefault();
    const employeeId = document.getElementById('employeeId').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    console.log(`DEBUG: handleLogin received: id='${employeeId}', pass='${password}', role='${role}'`);
    const user = employees.find(emp => (emp.id === employeeId || emp.email === employeeId) && emp.password === password && emp.role === role);
    if (user) {
        currentUser = user;
        console.log('DEBUG: handleLogin: User found, currentUser set to:', currentUser.id);
        // Removed showDashboard() and other UI calls for focused testing
        // showAlert('Login successful! Welcome ' + user.name, 'success');
    } else {
        currentUser = null; // Ensure currentUser is null on failed login
        console.log('DEBUG: handleLogin: User not found or credentials incorrect.');
        showAlert('Invalid credentials. Please try again.', 'error');
    }
    return user; // Return user for chaining or checking
}


function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function isWithinWorkHours(timeString, dateObj = new Date()) { // Added dateObj for testing specific times
    const [hours, minutes] = timeString.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;
    const startMinutes = parseInt(workHours.start.split(':')[0]) * 60 + parseInt(workHours.start.split(':')[1]);
    const endMinutes = parseInt(workHours.end.split(':')[0]) * 60 + parseInt(workHours.end.split(':')[1]);
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function updateAttendanceStatus() {
    if (!currentUser || currentUser.role !== 'employee') return;

    const today = new Date().toDateString();
    const todayRecords = attendanceData.filter(record =>
        record.employeeId === currentUser.id && record.date === today
    );

    const lastCheckIn = todayRecords.filter(r => r.type === 'in').pop();
    const lastCheckOut = todayRecords.filter(r => r.type === 'out').pop();

    const statusText = document.getElementById('statusText');
    const lastAction = document.getElementById('lastAction');
    const statusCard = document.getElementById('statusCard');
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');

    if (!statusText || !lastAction || !statusCard || !checkInBtn || !checkOutBtn) {
        // console.error("One or more DOM elements for attendance status not found in mock.");
        return;
    }

    if (!lastCheckIn) {
        statusText.textContent = 'Ready to Check In';
        lastAction.textContent = 'No check-in recorded today';
        statusCard.className = 'status-card';
        checkInBtn.disabled = false;
        checkOutBtn.disabled = true;
    } else if (!lastCheckOut || new Date(lastCheckIn.timestamp) > new Date(lastCheckOut.timestamp)) {
        statusText.textContent = 'Currently Checked In';
        lastAction.textContent = `Checked in at ${new Date(lastCheckIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
        statusCard.className = 'status-card'; // Assuming default is "checked-in" appearance
        checkInBtn.disabled = true;
        checkOutBtn.disabled = false;
    } else {
        statusText.textContent = 'Checked Out';
        lastAction.textContent = `Checked out at ${new Date(lastCheckOut.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
        statusCard.className = 'status-card checked-out';
        checkInBtn.disabled = false;
        checkOutBtn.disabled = true;
    }
}


function markAttendance(type) {
    console.log('DEBUG: markAttendance: Called with type', type, '. Current user at start:', currentUser ? currentUser.id : 'null');
    if (!currentUser) {
        showAlert('User not logged in.', 'error', 'alertContainer2');
        return;
    }
    if (!currentLocation) {
        showAlert('Location not detected. Please enable GPS and try again.', 'error', 'alertContainer2');
        return;
    }

    const distance = calculateDistance(
        currentLocation.lat, currentLocation.lng,
        geofenceConfig.centerLat, geofenceConfig.centerLng
    );
    const isWithinGeofence = distance <= geofenceConfig.radius;
    const currentTime = new Date();

    let timeStringToTest = currentTime.toTimeString().split(' ')[0];
    if (global.mockTime) {
        const parts = global.mockTime.split(':');
        currentTime.setHours(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2] || 0));
        timeStringToTest = global.mockTime;
    }


    if (!isWithinGeofence) {
        showAlert(`Attendance not allowed. You are ${Math.round(distance)}m away from the office zone.`, 'error', 'alertContainer2');
        return;
    }

    if (type === 'in' && !isWithinWorkHours(timeStringToTest, currentTime)) {
        showAlert('Check-in is only allowed during work hours (08:00 - 17:00).', 'error', 'alertContainer2');
        return;
    }

    // Prevent double check-in without check-out
    const todayRecords = attendanceData.filter(record => record.employeeId === currentUser.id && record.date === currentTime.toDateString());
    const lastRecord = todayRecords.pop();
    if (type === 'in' && lastRecord && lastRecord.type === 'in') {
        showAlert('You are already checked in. Please check out first.', 'error', 'alertContainer2');
        return;
    }
    if (type === 'out' && (!lastRecord || lastRecord.type === 'out')) {
        showAlert('You are not checked in or already checked out.', 'error', 'alertContainer2');
        return;
    }


    const attendanceRecord = {
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        type: type,
        timestamp: currentTime.toISOString(),
        location: currentLocation,
        distance: Math.round(distance),
        date: currentTime.toDateString()
    };

    attendanceData.push(attendanceRecord);
    updateAttendanceStatus();
    showAlert(`${type === 'in' ? 'Check-in' : 'Check-out'} recorded successfully!`, 'success', 'alertContainer2');
}


function loadAttendanceHistory() {
    if (!currentUser) return;
    const userRecords = attendanceData.filter(record => record.employeeId === currentUser.id);
    const historyContainer = document.getElementById('attendanceHistory');

    if (userRecords.length === 0) {
        historyContainer.innerHTML = '<p>No attendance records found.</p>';
        return;
    }

    const groupedRecords = {};
    userRecords.forEach(record => {
        const date = record.date;
        if (!groupedRecords[date]) groupedRecords[date] = [];
        groupedRecords[date].push(record);
    });

    let html = '<div class="attendance-grid">';
    Object.keys(groupedRecords).sort((a,b) => new Date(b) - new Date(a)).forEach(date => { // Sort by date descending
        const records = groupedRecords[date];
        const checkIn = records.find(r => r.type === 'in');
        const checkOut = records.find(r => r.type === 'out');
        html += `Date: ${date}, Check-in: ${checkIn ? new Date(checkIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : 'N/A'}, Check-out: ${checkOut ? new Date(checkOut.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : 'N/A'}; `;
    });
    html += '</div>';
    historyContainer.innerHTML = html;
}


// --- Test Execution ---
console.log("--- Test Suite: Employee Attendance Marking ---");

function runTest(testName, setupFn, actionFn, assertions) {
    console.log(`\n--- Running: ${testName} ---`);
    resetState();
    if (setupFn) setupFn();
    if (actionFn) actionFn();
    if (assertions) assertions();
}

// Test 1: Successful Check-in
runTest("Test 1: Successful Check-in",
    () => {
        document.getElementById('employeeId').value = 'emp001';
        document.getElementById('password').value = 'password123';
        document.getElementById('role').value = 'employee'; // Explicitly set role for Test 1
        handleLogin(); // Log in emp001
        global.mockLocation = { lat: -6.7924, lng: 39.2083, accuracy: 10 }; // Inside geofence
        global.mockTime = "09:00:00"; // Within work hours
        currentLocation = global.mockLocation; // Simulate location detection
    },
    () => markAttendance('in'),
    () => {
        console.log("  Alert:", lastAlert);
        console.log("  Attendance Data Count:", attendanceData.length);
        console.log("  First Record Type:", attendanceData.length > 0 ? attendanceData[0].type : "N/A");
        console.log("  Check-in button disabled:", document.getElementById('checkInBtn').disabled);
        console.log("  Check-out button enabled:", !document.getElementById('checkOutBtn').disabled);
        if (lastAlert !== 'Check-in recorded successfully!' || attendanceData.length !== 1 || !document.getElementById('checkInBtn').disabled || document.getElementById('checkOutBtn').disabled) console.error("  TEST 1 FAILED"); else console.log("  TEST 1 PASSED");
    }
);

// Test 2: Check-in Outside Geofence
runTest("Test 2: Check-in Outside Geofence",
    () => {
        document.getElementById('employeeId').value = 'emp001';
        document.getElementById('password').value = 'password123';
        handleLogin();
        currentUser = employees.find(e => e.id === 'emp001');
        global.mockLocation = { lat: -6.8000, lng: 39.2000, accuracy: 10 }; // Outside geofence
        global.mockTime = "09:00:00";
        currentLocation = global.mockLocation;
    },
    () => markAttendance('in'),
    () => {
        console.log("  Alert:", lastAlert);
        console.log("  Attendance Data Count:", attendanceData.length);
        if (!lastAlert.includes('Attendance not allowed') || attendanceData.length !== 0) console.error("  TEST 2 FAILED"); else console.log("  TEST 2 PASSED");
    }
);

// Test 3: Check-in Outside Work Hours (Too Early)
runTest("Test 3: Check-in Outside Work Hours (Too Early)",
    () => {
        document.getElementById('employeeId').value = 'emp001';
        document.getElementById('password').value = 'password123';
        handleLogin();
        currentUser = employees.find(e => e.id === 'emp001');
        global.mockLocation = { lat: -6.7924, lng: 39.2083, accuracy: 10 }; // Inside geofence
        global.mockTime = "07:00:00"; // Outside work hours (early)
        currentLocation = global.mockLocation;
    },
    () => markAttendance('in'),
    () => {
        console.log("  Alert:", lastAlert);
        console.log("  Attendance Data Count:", attendanceData.length);
        if (!lastAlert.includes('Check-in is only allowed during work hours') || attendanceData.length !== 0) console.error("  TEST 3 FAILED"); else console.log("  TEST 3 PASSED");
    }
);

// Test 4: Check-in Outside Work Hours (Too Late)
runTest("Test 4: Check-in Outside Work Hours (Too Late)",
    () => {
        document.getElementById('employeeId').value = 'emp001';
        document.getElementById('password').value = 'password123';
        handleLogin();
        currentUser = employees.find(e => e.id === 'emp001');
        global.mockLocation = { lat: -6.7924, lng: 39.2083, accuracy: 10 }; // Inside geofence
        global.mockTime = "18:00:00"; // Outside work hours (late)
        currentLocation = global.mockLocation;
    },
    () => markAttendance('in'),
    () => {
        console.log("  Alert:", lastAlert);
        console.log("  Attendance Data Count:", attendanceData.length);
        if (!lastAlert.includes('Check-in is only allowed during work hours') || attendanceData.length !== 0) console.error("  TEST 4 FAILED"); else console.log("  TEST 4 PASSED");
    }
);

// Test 5: Successful Check-out
runTest("Test 5: Successful Check-out",
    () => {
        document.getElementById('employeeId').value = 'emp001';
        document.getElementById('password').value = 'password123';
        handleLogin();
        currentUser = employees.find(e => e.id === 'emp001');
        global.mockLocation = { lat: -6.7924, lng: 39.2083, accuracy: 10 }; // Inside geofence
        currentLocation = global.mockLocation; // Set location for check-in

        global.mockTime = "09:00:00"; // Check-in time
        markAttendance('in'); // Successful check-in first

        global.mockTime = "17:30:00"; // Check-out time
    },
    () => markAttendance('out'),
    () => {
        console.log("  Alert:", lastAlert);
        console.log("  Attendance Data Count:", attendanceData.length);
        console.log("  Second Record Type:", attendanceData.length > 1 ? attendanceData[1].type : "N/A");
        console.log("  Check-in button enabled after checkout:", !document.getElementById('checkInBtn').disabled);
        console.log("  Check-out button disabled after checkout:", document.getElementById('checkOutBtn').disabled);
        if (lastAlert !== 'Check-out recorded successfully!' || attendanceData.length !== 2 || attendanceData[1].type !== 'out' || document.getElementById('checkInBtn').disabled || !document.getElementById('checkOutBtn').disabled) console.error("  TEST 5 FAILED"); else console.log("  TEST 5 PASSED");
    }
);

// Test 6: Attendance History
runTest("Test 6: Attendance History",
    () => {
        document.getElementById('employeeId').value = 'emp001';
        document.getElementById('password').value = 'password123';
        handleLogin();
        currentUser = employees.find(e => e.id === 'emp001');
        global.mockLocation = { lat: -6.7924, lng: 39.2083, accuracy: 10 };
        currentLocation = global.mockLocation;
        global.mockTime = "09:00:00";
        markAttendance('in');
        global.mockTime = "17:00:00";
        markAttendance('out');
    },
    () => loadAttendanceHistory(),
    () => {
        const historyHTML = document.getElementById('attendanceHistory').innerHTML;
        console.log("  HTML Output:", historyHTML);
        const today = new Date();
        const expectedDateString = today.toDateString();
        const expectedCheckInTime = new Date(today.setHours(9,0,0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        const expectedCheckOutTime = new Date(today.setHours(17,0,0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

        if (!historyHTML.includes(expectedDateString) || !historyHTML.includes(expectedCheckInTime) || !historyHTML.includes(expectedCheckOutTime)) console.error("  TEST 6 FAILED"); else console.log("  TEST 6 PASSED");
    }
);

// Test 7: Attempt to Check-out without Check-in
runTest("Test 7: Attempt to Check-out without Check-in",
    () => {
        document.getElementById('employeeId').value = 'emp001';
        document.getElementById('password').value = 'password123';
        handleLogin();
        currentUser = employees.find(e => e.id === 'emp001');
        global.mockLocation = { lat: -6.7924, lng: 39.2083, accuracy: 10 };
        currentLocation = global.mockLocation;
        global.mockTime = "10:00:00";
    },
    () => markAttendance('out'),
    () => {
        console.log("  Alert:", lastAlert);
        console.log("  Attendance Data Count:", attendanceData.length);
        if (!lastAlert.includes('You are not checked in or already checked out.') || attendanceData.length !== 0) console.error("  TEST 7 FAILED"); else console.log("  TEST 7 PASSED");
    }
);

// Test 8: Attempt to Check-in twice
runTest("Test 8: Attempt to Check-in twice",
    () => {
        document.getElementById('employeeId').value = 'emp001';
        document.getElementById('password').value = 'password123';
        handleLogin();
        currentUser = employees.find(e => e.id === 'emp001');
        global.mockLocation = { lat: -6.7924, lng: 39.2083, accuracy: 10 };
        currentLocation = global.mockLocation;
        global.mockTime = "09:30:00";
        markAttendance('in'); // First check-in
        global.mockTime = "09:35:00"; // Attempt another check-in
    },
    () => markAttendance('in'),
    () => {
        console.log("  Alert:", lastAlert);
        console.log("  Attendance Data Count:", attendanceData.length); // Should be 1 from the first check-in
        if (!lastAlert.includes('You are already checked in. Please check out first.') || attendanceData.length !== 1) console.error("  TEST 8 FAILED"); else console.log("  TEST 8 PASSED");
    }
);


console.log("\n--- Test Suite Complete ---");

// Simple overall status check
const testResults = [];
const originalConsoleLog = console.log;
console.log = (message) => {
    if (typeof message === 'string' && (message.includes("TEST") && (message.includes("PASSED") || message.includes("FAILED")))) {
        testResults.push(message);
    }
    originalConsoleLog(message);
}

// Re-log to capture
originalConsoleLog("--- Summary of Test Results ---");
let failedCount = 0;
let passedCount = 0;
const uniqueTestResults = [...new Set(testResults)]; // Avoid double counting from re-logging

uniqueTestResults.forEach(result => {
    originalConsoleLog(result); // Log each unique result line
    if (result.includes("TEST") && result.includes("FAILED")) {
        failedCount++;
    } else if (result.includes("TEST") && result.includes("PASSED")) {
        passedCount++;
    }
});

const totalTests = passedCount + failedCount;

if (failedCount === 0 && totalTests > 0) {
    originalConsoleLog(`All ${totalTests} attendance tests PASSED.`);
    process.exit(0);
} else if (totalTests > 0) {
    originalConsoleLog(`${failedCount} out of ${totalTests} attendance test(s) FAILED.`);
    process.exit(1);
} else {
    originalConsoleLog("No test results found or tests did not run correctly.");
    process.exit(1); // Considered a failure if no tests seemed to run
}
// Restore console.log
console.log = originalConsoleLog;
