// --- Mocking Browser Environment & HTML Elements ---
global.document = {
    _elements: {},
    getElementById: function(id) {
        if (!this._elements[id]) {
            this._elements[id] = {
                value: '', innerHTML: '', textContent: '', style: { display: 'none' },
                classList: { add: () => {}, remove: () => {} },
                addEventListener: () => {}, reset: () => {}, appendChild: (child) => {
                    // Simplified appendChild for table structure if needed later
                    if (!this._elements[id].children) this._elements[id].children = [];
                    this._elements[id].children.push(child);
                },
                querySelector: () => null, querySelectorAll: () => [],
                children: [], options: [], selectedOptions: [],
            };
            // Specific mocks for report generation inputs
            if (id === 'reportDate') {
                const today = new Date();
                this._elements[id].valueAsDate = today;
                this._elements[id].value = today.toISOString().split('T')[0]; // Format YYYY-MM-DD
            }
            if (id === 'reportType') {
                this._elements[id].value = 'daily'; // Default report type
            }
        }
        return this._elements[id];
    },
    createElement: (type) => {
        const element = {
            innerHTML: '',
            appendChild: (child) => {
                if(!element.children) element.children = [];
                element.children.push(child);
            },
            classList: { add: () => {} },
            setAttribute: () => {},
            style: {},
            children: [],
            insertCell: () => {
                const cell = { innerHTML: '', parentNode: element };
                if(!element.cells) element.cells = [];
                element.cells.push(cell);
                if(!element.children) element.children = []; // Ensure children exists for table rows
                element.children.push(cell); // Add cell to children for consistency
                return cell;
            },
            insertRow: () => {
                const row = module.exports.document.createElement('tr'); // Use the mock createElement
                if(!element.rows) element.rows = [];
                element.rows.push(row);
                if (element.tagName === 'TBODY' || element.tagName === 'THEAD' || element.tagName === 'TABLE') {
                     if(!element.children) element.children = [];
                     element.children.push(row);
                }
                return row;
            }
        };
        element.tagName = type.toUpperCase(); // Store tagName for potential conditional logic in JS code
        return element;
    },
    querySelectorAll: () => [], addEventListener: () => {},
};
// Make document available for module pattern if needed, or for direct use in script
module.exports = { document: global.document };


global.alert = (message) => { global.lastAlert = message; };
global.lastAlert = null;

// --- Extracted JavaScript from smartAttendance.html (essential parts) ---
let currentUser = null;
let employees = [
    { id: 'emp001', name: 'John Doe', email: 'john@company.com', department: 'IT', password: 'password123', role: 'employee' },
    { id: 'emp002', name: 'Jane Smith', email: 'jane@company.com', department: 'HR', password: 'password123', role: 'employee' },
    { id: 'admin', name: 'Administrator', email: 'admin@company.com', department: 'Admin', password: 'admin123', role: 'admin' }
];
let attendanceData = []; // This will be populated for tests

function resetStateAndLoginAdmin() {
    attendanceData = []; // Clear attendance data for fresh tests
    currentUser = null;
    global.lastAlert = null;

    // Clear mock DOM for relevant elements
    document._elements = {};

    document.getElementById('employeeId').value = 'admin';
    document.getElementById('password').value = 'admin123';
    document.getElementById('role').value = 'admin';
    handleLogin();
}

function handleLogin(e) { // Simplified from previous
    if(e) e.preventDefault();
    const employeeId = document.getElementById('employeeId').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    currentUser = employees.find(emp => (emp.id === employeeId || emp.email === employeeId) && emp.password === password && emp.role === role);
}

function showAlert(message, type, containerId = 'alertContainer') {
    // console.log(`ShowAlert (${type}, ${containerId}): ${message}`);
    global.lastAlert = message;
}

// loadRealTimeAttendance from HTML
function loadRealTimeAttendance() {
    if (!currentUser || currentUser.role !== 'admin') return;
    const container = document.getElementById('realTimeAttendance');
    if (!container) return;

    const today = new Date().toDateString();
    let html = `
        <table class="employee-table">
            <thead><tr><th>Employee</th><th>Status</th><th>Last Seen</th><th>Location</th></tr></thead>
            <tbody>
    `;

    employees.filter(emp => emp.role === 'employee').forEach(employee => {
        const todayRecords = attendanceData.filter(r => r.employeeId === employee.id && r.date === today);
        let status = "Absent";
        let lastSeen = "N/A";
        let locationInfo = "N/A";

        const lastCheckIn = todayRecords.filter(r => r.type === 'in').pop();
        const lastCheckOut = todayRecords.filter(r => r.type === 'out').pop();

        if (lastCheckIn) {
            if (lastCheckOut && new Date(lastCheckOut.timestamp) > new Date(lastCheckIn.timestamp)) {
                status = "Checked Out";
                lastSeen = new Date(lastCheckOut.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            } else {
                status = "Checked In";
                lastSeen = new Date(lastCheckIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            }
            locationInfo = `${lastCheckIn.distance}m from office`;
        }

        html += `<tr><td>${employee.name} (${employee.id})</td><td>${status}</td><td>${lastSeen}</td><td>${locationInfo}</td></tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
    // console.log("DEBUG: RealTimeAttendance HTML (first 250 chars):", html.substring(0,250));
}

// generateReport from HTML
function generateReport() {
    if (!currentUser || currentUser.role !== 'admin') return;

    const reportType = document.getElementById('reportType').value;
    const reportDateInput = document.getElementById('reportDate').value; // String like "YYYY-MM-DD"
    const reportDate = new Date(reportDateInput + "T00:00:00Z"); // Use Z for UTC to avoid timezone interpretation issues for date part

    const resultsContainer = document.getElementById('reportResults');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = ''; // Clear previous results

    let reportHtml = `<h4>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report for ${reportDate.toDateString()}</h4>`;
    let filteredData = [];

    if (reportType === 'daily') {
        const targetDateStr = reportDate.toDateString();
        // console.log(`DEBUG: Daily report for targetDateStr: ${targetDateStr}`);
        // console.log(`DEBUG: Attendance data dates:`, attendanceData.map(r => ({date: r.date, emp: r.employeeId}) ));
        filteredData = attendanceData.filter(r => r.date === targetDateStr);
    } else if (reportType === 'weekly') {
        const weekStart = new Date(reportDate);
        // Adjust weekStart to be the Sunday of that week, UTC
        weekStart.setUTCDate(reportDate.getUTCDate() - reportDate.getUTCDay());
        weekStart.setUTCHours(0,0,0,0);

        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
        weekEnd.setUTCHours(23,59,59,999);

        reportHtml = `<h4>Weekly Report for ${weekStart.toDateString()} - ${weekEnd.toDateString()}</h4>`;
        // console.log(`DEBUG: Weekly report: Start=${weekStart.toISOString()}, End=${weekEnd.toISOString()}`);
        filteredData = attendanceData.filter(r => {
            const recordDate = new Date(r.timestamp); // r.timestamp is ISO string (UTC)
            return recordDate >= weekStart && recordDate <= weekEnd;
        });
    } else if (reportType === 'monthly') {
        const monthStart = new Date(Date.UTC(reportDate.getUTCFullYear(), reportDate.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(reportDate.getUTCFullYear(), reportDate.getUTCMonth() + 1, 0, 23, 59, 59, 999)); // Last day of month, end of day UTC
        reportHtml = `<h4>Monthly Report for ${monthStart.toLocaleString('default', { month: 'long', timeZone: 'UTC' })} ${monthStart.getUTCFullYear()}</h4>`;
        // console.log(`DEBUG: Monthly report: Start=${monthStart.toISOString()}, End=${monthEnd.toISOString()}`);
        filteredData = attendanceData.filter(r => {
            const recordDate = new Date(r.timestamp); // r.timestamp is ISO string (UTC)
            return recordDate >= monthStart && recordDate <= monthEnd;
        });
    }

    // console.log(`DEBUG: Filtered data count for ${reportType}: ${filteredData.length}`);

    if (filteredData.length === 0) {
        reportHtml += "<p>No attendance records found for this period.</p>";
    } else {
        reportHtml += `<table class="employee-table"><thead><tr><th>Employee</th><th>Date</th><th>Check-In</th><th>Check-Out</th><th>Duration</th></tr></thead><tbody>`;
        const recordsByEmployeeDate = {};
        filteredData.forEach(r => {
            const key = r.employeeId + "_" + r.date;
            if (!recordsByEmployeeDate[key]) recordsByEmployeeDate[key] = { employeeName: r.employeeName, date: r.date, in: null, out: null };
            // Prioritize later check-ins or earlier check-outs if multiple exist for the same day (though typically not expected for this system)
            if (r.type === 'in' && (!recordsByEmployeeDate[key].in || new Date(r.timestamp) < new Date(recordsByEmployeeDate[key].in.timestamp))) recordsByEmployeeDate[key].in = r;
            if (r.type === 'out' && (!recordsByEmployeeDate[key].out || new Date(r.timestamp) > new Date(recordsByEmployeeDate[key].out.timestamp))) recordsByEmployeeDate[key].out = r;
        });

        for (const key in recordsByEmployeeDate) {
            const rec = recordsByEmployeeDate[key];
            let duration = "N/A";
            if (rec.in && rec.out) {
                const diffMs = new Date(rec.out.timestamp) - new Date(rec.in.timestamp);
                if (diffMs > 0) { // Ensure checkout is after checkin
                    duration = (diffMs / (1000 * 60 * 60)).toFixed(2) + " hrs";
                } else {
                    duration = "Error"; // Checkout before or at checkin time
                }
            }
            reportHtml += `<tr>
                <td>${rec.employeeName}</td>
                <td>${rec.date}</td>
                <td>${rec.in ? new Date(rec.in.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }) : 'N/A'}</td>
                <td>${rec.out ? new Date(rec.out.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }) : 'N/A'}</td>
                <td>${duration}</td>
            </tr>`;
        }
        reportHtml += `</tbody></table>`;
    }
    resultsContainer.innerHTML = reportHtml;
    // console.log("DEBUG: Report HTML (first 250 chars):", reportHtml.substring(0,250));
}


// --- Test Data Setup ---
function setupAttendanceData() {
    const today = new Date(); // Local today
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    const yesterdayUTC = new Date(todayUTC);
    yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1);

    // To ensure date strings match what `new Date().toDateString()` would produce from UTC timestamps
    const todayDateString = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0)).toDateString();
    const yesterdayDateString = new Date(Date.UTC(yesterdayUTC.getFullYear(), yesterdayUTC.getMonth(), yesterdayUTC.getDate(), 9, 0, 0)).toDateString();


    // Timestamps should be ISO strings (implying UTC as per JS Date standard when parsing/creating from ISO)
    const t0900 = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0)).toISOString();
    const t1700 = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0)).toISOString();

    const y0900 = new Date(Date.UTC(yesterdayUTC.getFullYear(), yesterdayUTC.getMonth(), yesterdayUTC.getDate(), 9, 0, 0)).toISOString();
    const y1700 = new Date(Date.UTC(yesterdayUTC.getFullYear(), yesterdayUTC.getMonth(), yesterdayUTC.getDate(), 17, 0, 0)).toISOString();


    attendanceData = [
        // emp001 - Today
        { employeeId: 'emp001', employeeName: 'John Doe', type: 'in', timestamp: t0900, date: todayDateString, distance: 10 },
        { employeeId: 'emp001', employeeName: 'John Doe', type: 'out', timestamp: t1700, date: todayDateString, distance: 10 },
        // emp002 - Today (only check-in)
        { employeeId: 'emp002', employeeName: 'Jane Smith', type: 'in', timestamp: t0900, date: todayDateString, distance: 15 },
        // emp001 - Yesterday
        { employeeId: 'emp001', employeeName: 'John Doe', type: 'in', timestamp: y0900, date: yesterdayDateString, distance: 12 },
        { employeeId: 'emp001', employeeName: 'John Doe', type: 'out', timestamp: y1700, date: yesterdayDateString, distance: 12 },
    ];
}

// --- Test Execution ---
console.log("--- Test Suite: Admin Attendance Insights ---");
let allTestsPassed = true;

function runTest(name, testFn) {
    console.log(`\n--- Running: ${name} ---`);
    resetStateAndLoginAdmin();
    setupAttendanceData(); // Ensure data is fresh for each test that needs it
    testFn();
}

runTest("Test 1: Real-time Attendance Monitor", () => {
    loadRealTimeAttendance();
    const realTimeHTML = document.getElementById('realTimeAttendance').innerHTML;

    const today = new Date();
    const t0900_localTime = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const t1700_localTime = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });


    const johnDoeFound = realTimeHTML.includes('John Doe');
    const johnDoeCheckedOut = johnDoeFound && realTimeHTML.includes('Checked Out') && realTimeHTML.includes(t1700_localTime);
    const janeSmithFound = realTimeHTML.includes('Jane Smith');
    const janeSmithCheckedIn = janeSmithFound && realTimeHTML.includes('Checked In') && realTimeHTML.includes(t0900_localTime);

    console.log("  HTML contains 'John Doe':", johnDoeFound);
    console.log("  John Doe status 'Checked Out' for today at expected time:", johnDoeCheckedOut);
    console.log("  HTML contains 'Jane Smith':", janeSmithFound);
    console.log("  Jane Smith status 'Checked In' for today at expected time:", janeSmithCheckedIn);

    if (johnDoeCheckedOut && janeSmithCheckedIn) {
        console.log("  TEST 1 PASSED");
    } else {
        console.log("  TEST 1 FAILED");
        allTestsPassed = false;
    }
});

runTest("Test 2: Daily Report", () => {
    const todayForReport = new Date(); // Use local today for setting the report date
    document.getElementById('reportType').value = 'daily';
    document.getElementById('reportDate').value = todayForReport.toISOString().split('T')[0];
    // document.getElementById('reportDate').valueAsDate = todayForReport; // Not directly used by generateReport, .value is key

    generateReport();
    const dailyReportHTML = document.getElementById('reportResults').innerHTML;

    // For report assertions, use UTC times as those are stored and processed
    const today = new Date(); // Local today, used for getting components like year, month, day
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();

    const t0900_reportTime = new Date(Date.UTC(todayYear, todayMonth, todayDay, 9, 0, 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });
    const y0900_reportTime_yesterday_time = new Date(Date.UTC(todayYear, todayMonth, todayDay - 1, 9, 0, 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });

    const reportDateForHeader = new Date(document.getElementById('reportDate').value + "T00:00:00Z"); // Date for the report header
    const yesterdayDateForSearch = new Date(Date.UTC(todayYear, todayMonth, todayDay - 1)).toDateString(); // String for yesterday's date, e.g., "Thu Jun 12 2025"


    const headerCorrect = dailyReportHTML.includes("Daily Report for " + reportDateForHeader.toDateString());
    const johnDoeToday = dailyReportHTML.includes('John Doe') && dailyReportHTML.includes(t0900_reportTime);
    const janeSmithToday = dailyReportHTML.includes('Jane Smith') && dailyReportHTML.includes(t0900_reportTime);

    // More specific check for yesterday's record: check for date string of yesterday + time string of yesterday's 9am
    const yesterdayRecordSignature = `<td>${yesterdayDateForSearch}</td><td>${y0900_reportTime_yesterday_time}</td>`;
    const noJohnDoeYesterdayRecord = !dailyReportHTML.includes(yesterdayRecordSignature);

    console.log("  HTML contains 'Daily Report for " + reportDateForHeader.toDateString() + "':", headerCorrect);
    console.log("  Contains John Doe's record for today:", johnDoeToday);
    console.log("  Contains Jane Smith's record for today:", janeSmithToday);
    console.log("  Does NOT contain yesterday's specific record signature (date + time):", noJohnDoeYesterdayRecord);

    if (headerCorrect && johnDoeToday && janeSmithToday && noJohnDoeYesterdayRecord) {
        console.log("  TEST 2 PASSED");
    } else {
        console.log("  TEST 2 FAILED");
        allTestsPassed = false;
    }
});

runTest("Test 3: Weekly Report", () => {
    const dateForWeeklyReport = new Date(); // Use local today
    document.getElementById('reportType').value = 'weekly';
    document.getElementById('reportDate').value = dateForWeeklyReport.toISOString().split('T')[0];

    generateReport();
    const weeklyReportHTML = document.getElementById('reportResults').innerHTML;

    const reportDateAnchor = new Date(document.getElementById('reportDate').value + "T00:00:00Z");
    const weekStart = new Date(reportDateAnchor);
    weekStart.setUTCDate(reportDateAnchor.getUTCDate() - reportDateAnchor.getUTCDay());
    weekStart.setUTCHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setUTCHours(23,59,59,999);

    const expectedWeeklyHeader = `Weekly Report for ${weekStart.toDateString()} - ${weekEnd.toDateString()}`;
    const headerCorrect = weeklyReportHTML.includes(expectedWeeklyHeader);

    const today = new Date();
    const t0900_reportTime = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });
    const y0900_reportTime_yesterday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()-1, 9, 0, 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });

    const johnDoeToday = weeklyReportHTML.includes('John Doe') && weeklyReportHTML.includes(t0900_reportTime);
    const johnDoeYesterday = weeklyReportHTML.includes('John Doe') && weeklyReportHTML.includes(y0900_reportTime_yesterday);

    console.log("  HTML contains '" + expectedWeeklyHeader + "':", headerCorrect);
    console.log("  Contains John Doe's today record:", johnDoeToday);
    console.log("  Contains John Doe's yesterday record:", johnDoeYesterday);

    if (headerCorrect && johnDoeToday && johnDoeYesterday) {
        console.log("  TEST 3 PASSED");
    } else {
        console.log("  TEST 3 FAILED");
        allTestsPassed = false;
    }
});

runTest("Test 4: Monthly Report", () => {
    const dateForMonthlyReport = new Date(); // Use local today
    document.getElementById('reportType').value = 'monthly';
    document.getElementById('reportDate').value = dateForMonthlyReport.toISOString().split('T')[0];

    generateReport();
    const monthlyReportHTML = document.getElementById('reportResults').innerHTML;

    const reportDateAnchor = new Date(document.getElementById('reportDate').value + "T00:00:00Z");
    const monthStart = new Date(Date.UTC(reportDateAnchor.getUTCFullYear(), reportDateAnchor.getUTCMonth(), 1));
    const expectedMonthlyHeader = `Monthly Report for ${monthStart.toLocaleString('default', { month: 'long', timeZone: 'UTC' })} ${monthStart.getUTCFullYear()}`;
    const headerCorrect = monthlyReportHTML.includes(expectedMonthlyHeader);

    const today = new Date();
    const t0900_reportTime = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });
    const y0900_reportTime_yesterday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()-1, 9, 0, 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });

    const johnDoeToday = monthlyReportHTML.includes('John Doe') && monthlyReportHTML.includes(t0900_reportTime);
    const johnDoeYesterday = monthlyReportHTML.includes('John Doe') && monthlyReportHTML.includes(y0900_reportTime_yesterday);

    console.log("  HTML contains '" + expectedMonthlyHeader + "':", headerCorrect);
    console.log("  Contains John Doe's today record:", johnDoeToday);
    console.log("  Contains John Doe's yesterday record:", johnDoeYesterday);

    if (headerCorrect && johnDoeToday && johnDoeYesterday) {
        console.log("  TEST 4 PASSED");
    } else {
        console.log("  TEST 4 FAILED");
        allTestsPassed = false;
    }
});

console.log("\n--- Test Suite Complete ---");
if (allTestsPassed) {
    console.log("All Admin Attendance Insights tests PASSED.");
    process.exit(0);
} else {
    console.log("Some Admin Attendance Insights tests FAILED.");
    process.exit(1);
}
//EOF
