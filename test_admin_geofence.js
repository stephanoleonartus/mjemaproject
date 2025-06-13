// --- Mocking Browser Environment & HTML Elements ---
global.document = {
    _elements: {},
    getElementById: function(id) {
        if (!this._elements[id]) {
            this._elements[id] = {
                value: '', innerHTML: '', textContent: '', style: { display: 'none' },
                classList: { add: () => {}, remove: () => {} },
                addEventListener: () => {}, reset: () => {}, appendChild: () => {},
                querySelector: () => null, querySelectorAll: () => [],
                children: [], options: [], selectedOptions: [],
            };
            // Set default values for geofence form elements if they are requested for the first time in a test setup
            if (id === 'locationName' && !this._elements[id].value) this._elements[id].value = 'Main Office';
            if (id === 'centerLat' && !this._elements[id].value) this._elements[id].value = '-6.7924';
            if (id === 'centerLng' && !this._elements[id].value) this._elements[id].value = '39.2083';
            if (id === 'radius' && !this._elements[id].value) this._elements[id].value = '100';
        }
        return this._elements[id];
    },
    createElement: (type) => ({ innerHTML: '', appendChild: () => {}, classList: {add:()=>{}}, style:{}, setAttribute:()=>{} }), // Basic mock
    querySelectorAll: () => [], addEventListener: () => {},
};
global.navigator = {
    geolocation: {
        getCurrentPosition: (successCb, errorCb, options) => {
            if (global.mockLocation) successCb({ coords: global.mockLocation });
            else errorCb({ code: 2, message: "Location not available for mock." });
        }
    }
};
global.alert = (message) => { global.lastAlert = message; };
global.lastAlert = null;
global.mockLocation = null; // To store employee's mock location

// --- Extracted JavaScript from smartAttendance.html (essential parts) ---
let currentUser = null;
let employees = [
    { id: 'emp001', name: 'John Doe', email: 'john@company.com', department: 'IT', password: 'password123', role: 'employee' },
    { id: 'admin', name: 'Administrator', email: 'admin@company.com', department: 'Admin', password: 'admin123', role: 'admin' }
];
let attendanceData = [];
let geofenceConfig = { name: 'Main Office', centerLat: -6.7924, centerLng: 39.2083, radius: 100 }; // Default
const workHours = { start: '08:00', end: '17:00' }; // Needed for markAttendance
let currentLocation = null; // For markAttendance

function resetContext() { // Renamed for clarity
    attendanceData = [];
    currentUser = null;
    lastAlert = null;
    global.mockLocation = null;
    currentLocation = null; // Reset global currentLocation used by markAttendance

    // Reset geofenceConfig variable to default
    geofenceConfig = { name: 'Main Office', centerLat: -6.7924, centerLng: 39.2083, radius: 100 };

    // Reset mock DOM input values for geofence form to reflect default geofenceConfig
    // This ensures that if an admin logs in, they see the default values initially.
    document.getElementById('locationName').value = geofenceConfig.name;
    document.getElementById('centerLat').value = geofenceConfig.centerLat.toString();
    document.getElementById('centerLng').value = geofenceConfig.centerLng.toString();
    document.getElementById('radius').value = geofenceConfig.radius.toString();
}

function loginUser(role = 'admin') {
    if (role === 'admin') {
        document.getElementById('employeeId').value = 'admin';
        document.getElementById('password').value = 'admin123';
        document.getElementById('role').value = 'admin';
    } else { // employee
        document.getElementById('employeeId').value = 'emp001';
        document.getElementById('password').value = 'password123';
        document.getElementById('role').value = 'employee';
    }
    handleLogin();
}


function handleLogin() {
    const employeeId = document.getElementById('employeeId').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    currentUser = employees.find(emp => (emp.id === employeeId || emp.email === employeeId) && emp.password === password && emp.role === role);
}

function showAlert(message, type, containerId = 'alertContainer') {
    // console.log(`ShowAlert (${type}, ${containerId}): ${message}`);
    global.lastAlert = message;
}

// updateGeofence from HTML
function updateGeofence() {
    if (!currentUser || currentUser.role !== 'admin') {
        showAlert('Permission denied. Only admins can update geofence.', 'error');
        return;
    }
    geofenceConfig.name = document.getElementById('locationName').value;
    geofenceConfig.centerLat = parseFloat(document.getElementById('centerLat').value);
    geofenceConfig.centerLng = parseFloat(document.getElementById('centerLng').value);
    geofenceConfig.radius = parseInt(document.getElementById('radius').value);
    showAlert('Geofence updated successfully!', 'success');
    // console.log("DEBUG: Geofence updated to:", geofenceConfig);
}

// calculateDistance from HTML
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// isWithinWorkHours from HTML
function isWithinWorkHours(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;
    const startMinutes = parseInt(workHours.start.split(':')[0]) * 60 + parseInt(workHours.start.split(':')[1]);
    const endMinutes = parseInt(workHours.end.split(':')[0]) * 60 + parseInt(workHours.end.split(':')[1]);
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}
function updateAttendanceStatus() { /* Mocked, not essential for this test's core logic */ }

// markAttendance from HTML (simplified for this test)
function markAttendance(type) {
    if (!currentUser) { showAlert('User not logged in.', 'error', 'alertContainer2'); return; }
    if (!currentLocation) { showAlert('Location not detected. Please enable GPS and try again.', 'error', 'alertContainer2'); return; }

    const distance = calculateDistance(currentLocation.lat, currentLocation.lng, geofenceConfig.centerLat, geofenceConfig.centerLng);
    const isWithinGeofence = distance <= geofenceConfig.radius;
    const currentTime = new Date();
    let timeStringToTest = currentTime.toTimeString().split(' ')[0];

    if (global.mockTime) { // Allow overriding time for testing work hours specifically if needed
        timeStringToTest = global.mockTime;
    }


    if (!isWithinGeofence) {
        showAlert(`Attendance not allowed. You are ${Math.round(distance)}m away from the office zone.`, 'error', 'alertContainer2');
        return;
    }
    if (type === 'in' && !isWithinWorkHours(timeStringToTest)) {
        showAlert('Check-in is only allowed during work hours (08:00 - 17:00).', 'error', 'alertContainer2');
        return;
    }
    attendanceData.push({ employeeId: currentUser.id, type: type, timestamp: currentTime.toISOString(), distance: Math.round(distance), date: currentTime.toDateString() });
    showAlert(`${type === 'in' ? 'Check-in' : 'Check-out'} recorded successfully!`, 'success', 'alertContainer2');
}


// --- Test Execution ---
console.log("--- Test Suite: Admin Geofence Configuration ---");
let allTestsPassed = true;

function runTest(name, testFn) {
    console.log(`\n--- Running: ${name} ---`);
    resetContext(); // Resets geofenceConfig, currentUser, attendanceData, DOM mocks etc.
    testFn();
}


runTest("Test 1: Admin updates geofence", () => {
    loginUser('admin'); // Log in as admin

    const newLat = -6.8000;
    const newLng = 39.2100;
    const newRadius = 50;

    document.getElementById('centerLat').value = newLat.toString();
    document.getElementById('centerLng').value = newLng.toString();
    document.getElementById('radius').value = newRadius.toString();
    updateGeofence();

    console.log("  Alert:", lastAlert);
    const latUpdated = geofenceConfig.centerLat === newLat;
    const lngUpdated = geofenceConfig.centerLng === newLng;
    const radiusUpdated = geofenceConfig.radius === newRadius;
    console.log("  GeofenceConfig Lat updated:", latUpdated);
    console.log("  GeofenceConfig Lng updated:", lngUpdated);
    console.log("  GeofenceConfig Radius updated:", radiusUpdated);

    if (lastAlert === 'Geofence updated successfully!' && latUpdated && lngUpdated && radiusUpdated) {
        console.log("  TEST 1 PASSED");
    } else {
        console.log("  TEST 1 FAILED");
        allTestsPassed = false;
    }
});

function performAdminGeofenceUpdate(lat, lng, radius) {
    const originalUser = currentUser; // Save current user
    loginUser('admin'); // Switch to admin

    document.getElementById('centerLat').value = lat.toString();
    document.getElementById('centerLng').value = lng.toString();
    document.getElementById('radius').value = radius.toString();
    updateGeofence();
    // console.log(`DEBUG: Admin updated geofence to Lat: ${lat}, Lng: ${lng}, Radius: ${radius}. Alert: ${lastAlert}`);

    currentUser = originalUser; // Switch back to original user
}


runTest("Test 2: Employee checks in - WITHIN new, smaller geofence", () => {
    const newLat = -6.8000;
    const newLng = 39.2100;
    const newRadius = 50;

    loginUser('employee'); // Start as employee
    performAdminGeofenceUpdate(newLat, newLng, newRadius); // Admin updates, then context switches back to employee

    global.mockLocation = { lat: -6.80001, lng: 39.21001, accuracy: 5 }; // Very close to new center
    currentLocation = global.mockLocation;
    global.mockTime = "10:00:00"; // Within work hours
    markAttendance('in');

    console.log("  Alert:", lastAlert);
    console.log("  Attendance records count:", attendanceData.length);
    const checkInSuccessful = lastAlert === 'Check-in recorded successfully!' && attendanceData.length === 1;
    if (checkInSuccessful) {
        console.log("  TEST 2 PASSED");
    } else {
        console.log("  TEST 2 FAILED");
        allTestsPassed = false;
    }
});

runTest("Test 3: Employee checks in - OUTSIDE new, smaller geofence (but was inside default)", () => {
    const newLat = -6.8000; // New geofence center
    const newLng = 39.2100;
    const newRadius = 50;   // New smaller radius

    loginUser('employee');
    performAdminGeofenceUpdate(newLat, newLng, newRadius);

    // This location is the *default* center, which is now outside the new smaller geofence.
    // Default: lat: -6.7924, lng: 39.2083, radius: 100
    // Distance from (-6.7924, 39.2083) to new center (-6.8000, 39.2100) is approx 875m.
    // This is > newRadius (50m).
    global.mockLocation = { lat: -6.7924, lng: 39.2083, accuracy: 10 };
    currentLocation = global.mockLocation;
    global.mockTime = "10:00:00";
    markAttendance('in');

    console.log("  Alert:", lastAlert);
    console.log("  Attendance records count:", attendanceData.length);
    const checkInDenied = lastAlert && lastAlert.startsWith('Attendance not allowed.') && attendanceData.length === 0;
     if (checkInDenied) {
        console.log("  TEST 3 PASSED");
    } else {
        console.log("  TEST 3 FAILED");
        allTestsPassed = false;
    }
});

runTest("Test 4: Employee checks in - FAR OUTSIDE new geofence", () => {
    const newLat = -6.8000;
    const newLng = 39.2100;
    const newRadius = 50;

    loginUser('employee');
    performAdminGeofenceUpdate(newLat, newLng, newRadius);

    global.mockLocation = { lat: -10.0000, lng: 40.0000, accuracy: 10 }; // Far from both default and new
    currentLocation = global.mockLocation;
    global.mockTime = "10:00:00";
    markAttendance('in');

    console.log("  Alert:", lastAlert);
    console.log("  Attendance records count:", attendanceData.length);
    const checkInDeniedFar = lastAlert && lastAlert.startsWith('Attendance not allowed.') && attendanceData.length === 0;

    if (checkInDeniedFar) {
        console.log("  TEST 4 PASSED");
    } else {
        console.log("  TEST 4 FAILED");
        allTestsPassed = false;
    }
});


console.log("\n--- Test Suite Complete ---");
if (allTestsPassed) {
    console.log("All Admin Geofence Configuration tests PASSED.");
    process.exit(0);
} else {
    console.log("Some Admin Geofence Configuration tests FAILED.");
    process.exit(1);
}
//EOF
