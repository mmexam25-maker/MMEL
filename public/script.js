
  function updateDateTime() {
    const now = new Date();

    const date = now.toLocaleDateString("en-GB"); // DD/MM/YYYY
    const time = now.toLocaleTimeString("en-GB"); // HH:MM:SS

    document.getElementById("datetime").innerText =
      date + "  " + time;
  }

  updateDateTime();
  setInterval(updateDateTime, 1000);


  

function loadCompletedList() {
  google.script.run
    .withSuccessHandler(rows => {
      console.log("Rows received:", rows);

      const body = document.getElementById("sucessBody");
      body.innerHTML = "";

      if (!rows || rows.length === 0) {
        body.innerHTML = "<tr><td colspan='7'>No completed records</td></tr>";
        return;
      }

      rows.forEach(r => {
        const tr = document.createElement("tr");
       tr.innerHTML = `
  <td>
  <input type="radio"
       name="certIndos"
       value="${r.rowIndex}"
       data-email="${r.email}"
       data-course="${r.courses || ''}">
  </td>
  <td>${r.indos || ""}</td>
  <td>${r.dob || ""}</td>
  <td>${r.enrolledBy || ""}</td>
  <td>${r.status || ""}</td>
  <td>${r.datetime || ""}</td>
  <td>${
  (r.courses || "")
    .split(",")
    .map(c =>
      c.trim() === "PSSRA"
        ? `<span class="blink-pssrA">${c}</span>`
        : c.trim()
    )
    .join(", ")
}</td>

`;
        body.appendChild(tr);
      });
    })
    .withFailureHandler(err => {
      showDialog("warning","SCRIPT ERROR: ",+ err.message);
      console.error(err);
    })
    .getCompletedForCertificate();
}

window.onload = loadCompletedList;


function sendCertificate() {

  // ✅ FIRST get selected
  const selected = document.querySelector('input[name="certIndos"]:checked');

  if (!selected) {
    showDialog("warning","Info","Select a candidate first");
    return;
  }

  // ✅ NOW get course
  const courseName = selected.dataset.course || "";

  const rowIndex = Number(selected.value);
  const email = selected.dataset.email;

  if (!email) {
    showDialog("error","Missing Data","No mail ID available");
    return;
  }

  const fileInput = document.getElementById("certFile");
  if (!fileInput.files.length) {
    showDialog("warning","Data missing","Please upload certificate PDF");
    return;
  }

  // ✅ OPEN WHATSAPP WINDOW FIRST
  const waWindow = window.open("about:blank", "_blank");

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function () {

    google.script.run
      .withFailureHandler(err => {
        waWindow.close();
        showDialog("error","error","ERROR: " + err.message);
      })
      .withSuccessHandler(msg => {

        showDialog("info","success",msg);

        google.script.run
          .withSuccessHandler(() => {

            google.script.run
              .withSuccessHandler(phone => {

                if (!phone) {
                  waWindow.close();
                  showDialog("error","Info Missing","No WhatsApp number found");
                  return;
                }


const text =
`Dear Candidate,

Your certificate has been issued successfully.

Course Name:
${courseName}

Kindly check your registered mail for the certificate.

If the mail is not received, please check your Spam/Junk folder.

Thank you for choosing Mariners Mentor.
We look forward to assist you again.

*With Regards*
*Mariners Mentor*`;

waWindow.location.href =
  "https://wa.me/" + phone +
  "?text=" + encodeURIComponent(text);


              })
              .getContactByRow(rowIndex);

            loadCertificateList();

          })
          .markCertificateIssued(rowIndex);

      })
      .sendCertificateWithAttachment({
        email: email,
        filename: file.name,
        data: reader.result,
        course: courseName
      });

  };

  reader.readAsDataURL(file);
}


  
  



const v=id=>document.getElementById(id).value;
function dataObj() {

  // ===============================
  // SELECTED COURSES
  // ===============================

  const selectedCourses = Array.from(
    document.querySelectorAll('input[name="courses"]:checked')
  )
  .map(cb => cb.value.trim())
  .filter(Boolean);

// ===============================
// COURSE STAFF MAPPING
// ===============================
const COURSE_STAFF_DATA = {
  "Course Staff 1": "Subha",
  "Course Staff 2": "Sekar"
};

// These courses belong to Course Staff 2
const courseStaff2CoursesData = [
  "EFA",
  "PSSR",
  "PSSR(A)",
  "BST",
  "STDSD"
];

// ===============================
// AUTO CASE TAKEN BY
// ===============================

let caseByList = [];

selectedCourses.forEach(course => {

  if (courseStaff2CoursesData.includes(course)) {

    if (!caseByList.includes(COURSE_STAFF_DATA["Course Staff 2"])) {
      caseByList.push(COURSE_STAFF_DATA["Course Staff 2"]);
    }

  } else {

    if (!caseByList.includes(COURSE_STAFF_DATA["Course Staff 1"])) {
      caseByList.push(COURSE_STAFF_DATA["Course Staff 1"]);
    }

  }

});

const autoCaseBy = caseByList.join(", ");
  // ===============================
  // RETURN OBJECT
  // ===============================

  return {

    name: v("name"),
    dob: v("dob"),
    indos: v("indos"),
    indospw: v("indospw"),
    contact: v("contact"),
    username: v("username"),
    elpwd: v("elpwd"),

    paymentMode: v("paymentMode"),
    money: v("money"),

    // ✅ AUTO SAVE
    caseBy: autoCaseBy,

    // ✅ MANUAL
    enrolledBy: v("enrolledBy"),

    followedBy: v("followedBy"),
    status: v("status"),
    certificate: v("certificate"),

    // ✅ COURSES
    courses: selectedCourses.join(", "),

    // ✅ EXTRA
    courseBooking:
      document.getElementById("courseBooking")
        ? Array.from(
            document.getElementById("courseBooking").selectedOptions
          )
          .map(opt => opt.value)
          .filter(Boolean)
          .join(", ")
        : "",

    agentName:
      document.getElementById("agentName")?.value || "",

    link:
      document.getElementById("docLink")?.value || ""

  };
}
function complete(){
  google.script.run.withSuccessHandler(()=>{
    showDialog("success","Action done","Moved to Completed");
    resetForm();
  }).markCompleted(v("indos"));
}

function resetForm() {

  // Clear inputs & selects
  document.querySelectorAll("input, select").forEach(el => {
    if (el.type !== "checkbox") {
      el.value = "";
    }
  });

  // 🔥 Uncheck all course checkboxes
  document.querySelectorAll('input[name="courses"]').forEach(cb => {
    cb.checked = false;
  });
}
function whatsappCandidate(waWindow, data) {

  let phone = String(data.contact || "").replace(/\D/g, "");

  if (!phone) {
    if (waWindow && !waWindow.closed) waWindow.close();
    showDialog("warning","WhatsApp","Candidate contact number is missing");
    return;
  }

  if (phone.length === 10) {
    phone = "91" + phone;
  }

  const selectedCourses = String(data.courses || "")
    .split(",")
    .map(c => c.trim())
    .filter(Boolean);

  let senderName = "Subha";
  let senderPhone = "9384196416";

  const courseStaff2CoursesWA = [
    "EFA",
    "PSSR",
    "PSSR(A)",
    "BST",
    "STDSD"
  ];

  const hasCourseStaff2Course = selectedCourses.some(c =>
    courseStaff2CoursesWA.includes(c)
  );

  if (hasCourseStaff2Course) {
    senderName = "Sekar";
    senderPhone = "6383487382";
  }

  const msg =
`Dear ${data.name || "Candidate"},

Your Course Application Process has been started successfully.

Courses:
${selectedCourses.join(", ")}

For further updates kindly stay connected with us.

Contact:
${senderPhone}

Thank you for choosing Mariners Mentor.
We look forward to assisting you again.

*With Regards*
*Mariners Mentor*`;

  const url =
    "https://wa.me/" +
    phone +
    "?text=" +
    encodeURIComponent(msg);

  if (waWindow && !waWindow.closed) {
    waWindow.location.href = url;
  } else {
    window.open(url, "_blank");
  }
}

// =====================================================
// OUTSOURCE WHATSAPP
// Sends to the phone in CONTACTS!B for the person selected
// in the Followed By dropdown (CONTACTS!A).
// =====================================================
function whatsappOutsource(waWindow, data) {

  const followedBy = String(data.followedBy || "").trim();

  if (!followedBy) {
    if (waWindow && !waWindow.closed) waWindow.close();
    showDialog("warning", "Outsource WhatsApp", "Please select Followed By");
    return;
  }

  const outsourceLink = "https://tinyurl.com/mr25vhty";

  // Message format kept like the WhatsApp screenshot.
  const msg =
`Dear ${followedBy},

Candidate Details

Name      : ${data.name || ""}
Courses   : ${data.courses || ""}
INDOS No  : ${data.indos || ""}
Username  : ${data.username || ""}
E-Learning Password : ${data.elpwd || ""}

Outsource Completion Link:
${outsourceLink}

Document Link:
${data.link || ""}

Enrolled By:${data.enrolledBy || ""}

*With Regards*
*Mariners Mentor*`;

  google.script.run
    .withSuccessHandler(function(phone) {

      phone = String(phone || "").replace(/\D/g, "");

      if (!phone) {
        if (waWindow && !waWindow.closed) waWindow.close();
        showDialog(
          "warning",
          "Outsource WhatsApp",
          "Phone number not found in CONTACTS for " + followedBy
        );
        return;
      }

      // Add India country code for normal 10-digit mobile numbers.
      if (phone.length === 10) {
        phone = "91" + phone;
      }

      const url =
        "https://wa.me/" +
        phone +
        "?text=" +
        encodeURIComponent(msg);

      if (waWindow && !waWindow.closed) {
        waWindow.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    })
    .withFailureHandler(function(err) {
      if (waWindow && !waWindow.closed) waWindow.close();
      showDialog(
        "error",
        "Outsource WhatsApp",
        err && err.message ? err.message : String(err)
      );
    })
    .getOutsourcePhone(followedBy);
}


function dobAuto(el) {

  // allow only numbers
  let v = el.value.replace(/\D/g, '');

  // limit to 8 digits
  v = v.slice(0, 8);

  // auto format
  if (v.length >= 5) {
    el.value = v.slice(0,2) + '/' + v.slice(2,4) + '/' + v.slice(4);
  } else if (v.length >= 3) {
    el.value = v.slice(0,2) + '/' + v.slice(2);
  } else {
    el.value = v;
  }
}


function attachDocumentLink(){

  const link = (document.getElementById("docLink")?.value || "").trim();

  if (!link) {
    showDialog("warning", "Document Link", "Paste the document link first");
    return;
  }

  try {
    new URL(link);
  } catch (e) {
    showDialog("warning", "Invalid Link", "Please paste a valid document link");
    return;
  }

  // Attach only confirms the link. No WhatsApp is opened here.
  showDialog(
    "success",
    "Attached",
    "Document link attached. WhatsApp will open only after Submit."
  );
}


function submitForm(){

  const data = dataObj();

  // =========================
  // BASIC VALIDATION
  // =========================
  if(!data.indos){
    showDialog(
      "warning",
      "Missing Field",
      "INDOS No is required"
    );
    return;
  }

  data.indos = data.indos.toUpperCase().trim();

  const indosPattern = /^[0-9]{2}[A-Z]{2}[0-9]{4}$/;

  if(!indosPattern.test(data.indos)){
    showDialog(
      "warning",
      "Invalid INDOS",
      "INDOS must be like: 00KK0000"
    );
    return;
  }

  // Candidate number mandatory
  if(!data.contact){
    showDialog(
      "warning",
      "Candidate WhatsApp",
      "Please enter Candidate Contact Number"
    );
    return;
  }

  let candidatePhone =
    String(data.contact).replace(/\D/g,"");

  if(candidatePhone.length !== 10 &&
     candidatePhone.length !== 12){

    showDialog(
      "warning",
      "Candidate WhatsApp",
      "Please enter a valid Candidate WhatsApp number"
    );
    return;
  }

  // Followed By mandatory
  if(!data.followedBy){

    showDialog(
      "warning",
      "Outsource WhatsApp",
      "Please select Followed By"
    );

    return;
  }


  // =========================
  // COURSE BOOKING
  // =========================
  const courseSelect =
    document.getElementById("courseBooking");

  if(courseSelect){

    data.courseBooking =
      Array.from(courseSelect.selectedOptions)
        .map(opt => opt.value)
        .filter(Boolean)
        .join(", ");

  } else {

    data.courseBooking = "";

  }


  data.agentName =
    document.getElementById("agentName")?.value || "";


  // ===================================================
  // RESERVE TWO WHATSAPP WINDOWS IMMEDIATELY
  // Browser sees these as coming directly from SUBMIT
  // ===================================================

  const candidateWaWindow =
    window.open("about:blank", "candidateWhatsApp");

  const outsourceWaWindow =
    window.open("about:blank", "outsourceWhatsApp");


  if(!candidateWaWindow || !outsourceWaWindow){

    if(candidateWaWindow) candidateWaWindow.close();
    if(outsourceWaWindow) outsourceWaWindow.close();

    showDialog(
      "warning",
      "Pop-up Blocked",
      "Please allow Pop-ups and redirects for this page, then click Submit again."
    );

    return;
  }


  candidateWaWindow.document.write(
    "<h3 style='font-family:Arial'>Preparing Candidate WhatsApp...</h3>"
  );

  outsourceWaWindow.document.write(
    "<h3 style='font-family:Arial'>Preparing Outsource WhatsApp...</h3>"
  );


  // =========================
  // SAVE
  // =========================
  google.script.run

    .withSuccessHandler(function(msg){

      // =========================
      // 1. CANDIDATE WHATSAPP
      // =========================
      whatsappCandidate(
        candidateWaWindow,
        data
      );


      // =========================
      // 2. OUTSOURCE WHATSAPP
      // =========================
      whatsappOutsource(
        outsourceWaWindow,
        data
      );


      showDialog(
        "success",
        "Saved",
        "Candidate and Outsource WhatsApp opened"
      );

      resetForm();

    })

    .withFailureHandler(function(err){

      if(candidateWaWindow &&
         !candidateWaWindow.closed){
        candidateWaWindow.close();
      }

      if(outsourceWaWindow &&
         !outsourceWaWindow.closed){
        outsourceWaWindow.close();
      }

      showDialog(
        "error",
        "Save Failed",
        err.message
      );

    })

    .savePSSR(data);
}



// CREATE DIALOG AUTOMATICALLY WHEN PAGE LOADS
document.addEventListener("DOMContentLoaded", function(){

  const dialogHTML = `
  <div id="dialogOverlay" style="
    display:none;
    position:fixed;
    top:0;
    left:0;
    width:100%;
    height:100%;
    background:rgba(0,0,0,0.35);
    z-index:99999;
    align-items:center;
    justify-content:center;
  ">
    <div style="
      background:#fff;
      padding:20px 25px;
      border-radius:8px;
      min-width:280px;
      text-align:center;
      box-shadow:0 6px 25px rgba(0,0,0,0.3);
      animation:dialogPop 0.2s ease;
    ">
      <div id="dialogIcon" style="font-size:32px;margin-bottom:8px;"></div>

      <div id="dialogTitle" style="
        font-size:18px;
        font-weight:bold;
        margin-bottom:5px;
      "></div>

      <div id="dialogMessage" style="
        font-size:14px;
        margin-bottom:15px;
      "></div>

      <button onclick="closeDialog()" style="
        background:#8b3a3a;
        color:#fff;
        border:none;
        padding:7px 20px;
        border-radius:5px;
        cursor:pointer;
      ">OK</button>
    </div>
  </div>

  <style>
  @keyframes dialogPop{
    from{transform:scale(.8);opacity:0;}
    to{transform:scale(1);opacity:1;}
  }
  </style>
  `;

  document.body.insertAdjacentHTML("beforeend", dialogHTML);

});


// SHOW DIALOG FUNCTION
function showDialog(type,title,message){

  const icons={
    success:"✔",
    error:"✖",
    warning:"⚠",
    info:"ℹ"
  };

  const colors={
    success:"#2e7d32",
    error:"#c62828",
    warning:"#ed6c02",
    info:"#1565c0"
  };

  document.getElementById("dialogIcon").innerHTML = icons[type] || "";
  document.getElementById("dialogIcon").style.color = colors[type];

  document.getElementById("dialogTitle").innerText = title;
  document.getElementById("dialogTitle").style.color = colors[type];

  document.getElementById("dialogMessage").innerText = message;

  document.getElementById("dialogOverlay").style.display="flex";
}


// CLOSE DIALOG
function closeDialog(){
  document.getElementById("dialogOverlay").style.display="none";
}


  

function openTab(id, btn){

  document.querySelectorAll('.tab-page')
    .forEach(p => p.classList.remove('active'));

  document.querySelectorAll('.tab-btn')
    .forEach(b => b.classList.remove('active'));

  document.getElementById(id).classList.add('active');
  btn.classList.add('active');

  if (id === "completed") {
    loadCompletedUI();
  }
}


function openDetailsSubTab(id, btn){

  // REMOVE ACTIVE
  document.querySelectorAll('.details-section')
    .forEach(el=>{
      el.classList.remove('active');
    });

  document.querySelectorAll('.subtab')
    .forEach(el=>{
      el.classList.remove('active');
    });

  // OPEN SECTION
  const page =
    document.getElementById("details-" + id);

  if(page){
    page.classList.add('active');
  }

  // ACTIVE BUTTON
  if(btn){
    btn.classList.add('active');
  }

  // LOAD COMPLETED TAB
  if(id === "completed"){
    loadCompletedUI();
  }

}



  



function completedClick() {

  const indos = document.getElementById("indos").value;

  if (!indos) {
    showDialog("warning","data missing","Please search INDOS first");
    return;
  }

  google.script.run
    .withSuccessHandler(msg => {
      showDialog("success","success",msg);
    })
    .withFailureHandler(err => {
      showDialog("ERROR","ERROR", + err.message);
    })
    .markCompleted(indos);
}


function toggleCourses() {
 const box = document.getElementById("coursesBox");

if (box) {
  box.style.display = "block";

  box.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  box.style.transition = "0.3s";
  box.style.boxShadow = "0 0 0 3px #2e7d32";

  setTimeout(() => {
    box.style.boxShadow = "none";
  }, 1500);
}
}




function setSelect(id, value) {
  if (!value) return;

  const sel = document.getElementById(id);
  if (!sel) return;

  const v = value.toString().trim().toLowerCase();

  Array.from(sel.options).forEach(opt => {
    if (opt.value.toLowerCase() === v) {
      sel.value = opt.value;
    }
  });
}





let existingCandidate = null;

function search() {
  const indos = document.getElementById("indos").value.trim();

  if (!indos) {
    showDialog("info", "Data required", "Enter INDOS No");
    return;
  }

  google.script.run
    .withFailureHandler(err => {
      showDialog("error", "Error", err.message);
    })
    .withSuccessHandler(res => {

      // NOT FOUND
      if (!res || !res.found) {
        existingCandidate = null;

        const addBtn = document.getElementById("addCourseBtn");
        if (addBtn) addBtn.style.display = "none";

        showDialog("warning", "Data missing", "INDOS NOT FOUND");
        return;
      }

      // FOUND
      existingCandidate = res;
      const r = res.row || {};

      const addBtn = document.getElementById("addCourseBtn");
      if (addBtn) addBtn.style.display = "inline-block";

      // =========================
      // BASIC FIELDS
      // =========================
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || "";
      };

      setVal("name", r.name);
      setVal("dob", r.dob);
      setVal("indos", r.indos);
      setVal("indospw", r.indospw);
      setVal("contact", r.contact);
      setVal("username", r.username);
      setVal("elpwd", r.elpwd);
      setVal("money", r.money);

      // =========================
      // DROPDOWNS
      // =========================
      setSelect("paymentMode", r.paymentMode);
      setSelect("caseBy", r.caseBy);
      setSelect("enrolledBy", r.enrolledBy);
      setSelect("followedBy", r.followedBy);
      setSelect("status", r.status);
      setSelect("certificate", r.certificate);

      // =========================
      // EXTRA FIELDS
      // =========================
      setVal("agentName", r.agentName);
      setVal("docLink", r.link);

      // =========================
      // COURSES
      // =========================
      document.querySelectorAll('input[name="courses"]').forEach(cb => {
        cb.checked = false;
      });

      if (r.courses) {
        r.courses.split(",").map(c => c.trim()).forEach(c => {
          const cb = document.querySelector(
            `input[name="courses"][value="${c}"]`
          );
          if (cb) cb.checked = true;
        });
      }

      // =========================
      // COURSE BOOKING
      // =========================
      const booking = String(r.courseBooking || "")
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);

      const bookingSelect = document.getElementById("courseBooking");
      if (bookingSelect) {
        Array.from(bookingSelect.options).forEach(opt => {
          opt.selected = booking.includes(opt.value);
        });
      }

      // =========================
      // SHOW / SCROLL COURSES
      // =========================
      const box = document.getElementById("coursesBox");
      if (box) {
        box.style.display = "block";

        box.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

        box.style.transition = "0.3s";
        box.style.boxShadow = "0 0 0 3px #2e7d32";

        setTimeout(() => {
          box.style.boxShadow = "none";
        }, 1500);
      }
    })
    .searchByIndos(indos);
}


  

let currentPage = 1;
const pageSize = 15;

function nextPage() {
  loadCompleted(currentPage + 1);
}

function prevPage() {
  if (currentPage > 1) loadCompleted(currentPage - 1);
}

/* auto load first page */
if (typeof loadCompleted === "function") {
  loadCompleted(1);
}


  

let certPage = 1;
const certPageSize = 5;
let certTotal = 1;

function loadCertPage(page){

  google.script.run
    .withSuccessHandler(res=>{

      certPage = res.page;
      certTotal = res.totalPages;

      const body =
        document.getElementById("successBody");

      body.innerHTML = "";

      if(!res.rows || res.rows.length===0){

        body.innerHTML =
        "<tr><td colspan='6'>No records found</td></tr>";

        return;
      }

      res.rows.forEach(r=>{

        body.innerHTML += `
          <tr>
            <td>
              <input type="radio"
                     name="certIndos"
                     value="${r.rowIndex}"
                     data-email="${r.email || ''}"
                     data-course="${r.courses || ''}">
            </td>

            <td>${r.indos || ""}</td>
            <td>${r.dob || ""}</td>
            <td>${r.enrolledBy || ""}</td>
            <td>${r.status || ""}</td>
            <td>${r.courses || ""}</td>
          </tr>
        `;
      });

      const info =
        document.getElementById("certPageInfo");

      if(info){
        info.innerText =
          "Page " + certPage +
          " of " + certTotal;
      }

    })

    .withFailureHandler(err=>{

      showDialog(
        "error",
        "Load Failed",
        err.message
      );

    })

    .getCompletedPage(page, certPageSize);

}

function certNext(){

  if(certPage < certTotal){
    loadCertPage(certPage + 1);
  }

}

function certPrev(){

  if(certPage > 1){
    loadCertPage(certPage - 1);
  }

}

window.addEventListener("load",()=>{

  loadCertPage(1);

});




function loadCompletedUI() {
  google.script.run
    .withSuccessHandler(rows => {

      const body = document.getElementById("completedBody");
      body.innerHTML = "";

      if (!rows || rows.length === 0) {
        body.innerHTML = "<tr><td colspan='3'>No completed records</td></tr>";
        return;
      }

      rows.forEach(r => {

        const coursesHtml = (r.courses || "-")
          .split(",")
          .map(c => {
            c = c.trim();
            if (c === "PSSR(A)") {
              return `<span class="blink-pssrA">${c}</span>`;
            }
            return c;
          })
          .join(", ");

        body.innerHTML += `
          <tr>
            <td>${r.indos}</td>
            <td>${r.status}</td>
            <td>${coursesHtml}</td>
          </tr>
        `;
      });
    })
    .getCompletedForUI();
}





function sendPhotoMail() {

  const name = document.getElementById("name").value;
  const followedBy = document.getElementById("followedBy").value;
  const fileInput = document.getElementById("photoFile");

  if (!name) {
    showDialog("info","Data needed","Please enter Name");
    return;
  }

  if (!followedBy) {
    showDialog("warning","Data needed","Please select Followed By");
    return;
  }

  if (!fileInput.files.length) {
    showDialog("warning","error","Please choose a photo");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function () {
    const base64Data = reader.result.split(",")[1];

    google.script.run
      .withSuccessHandler(() => {
        showDialog("success","SUCCESS","Mail sent successfully");
        fileInput.value = "";
      })
      .withFailureHandler(err => showDialog("error","ERROR",err.message))
      .sendPhotoToFollowedBy(
        name,          // ✅ NAME FIRST
        followedBy,    // ✅ FOLLOWED BY SECOND
        base64Data,
        file.name
      );
  };

  reader.readAsDataURL(file);
}





function formatName(el){

  let value = el.value.toLowerCase();

  value = value.replace(/\b\w/g, function(letter){
    return letter.toUpperCase();
  });

  el.value = value;

}

  




function loadEnTime() {

  const from = document.getElementById("fromDateTime").value;
  const to   = document.getElementById("toDateTime").value;

  if (!from || !to) {
    showDialog(
      "warning",
      "Missing Date",
      "Select From and To date"
    );
    return;
  }

  showDialog(
    "info",
    "Loading",
    "Please wait..."
  );

  google.script.run
    .withSuccessHandler(renderEnTime)
    .withFailureHandler(err =>
      showDialog("error","Load Failed",err.message)
    )
    .getOutsourceTimeByDate(from, to);

}


function renderEnTime(rows) {

  const body = document.getElementById("entimeBody");
  body.innerHTML = "";

  if (!rows || rows.length === 0) {
    body.innerHTML = "<tr><td colspan='3'>No data</td></tr>";
    return;
  }

  rows.forEach(r => {
    body.innerHTML += `
      <tr>
        <td>${r.outsource}</td>
        <td>${r.hours.toFixed(2)}</td>
        <td>
          <button onclick="downloadPDF('${r.outsource}')">
            Download PDF
          </button>
        </td>
      </tr>
    `;
  });
}







function downloadPDF(outsource)
{
  const from = document.getElementById("fromDateTime").value;
  const to   = document.getElementById("toDateTime").value;

  if (!from || !to)
  {
    alert("Select From and To date");
    return;
  }

  google.script.run
    .withFailureHandler(err =>
      alert("Error: " + err.message))
    .withSuccessHandler(function(base64)
    {
      if (!base64)
      {
        alert("PDF generation failed");
        return;
      }

      const link = document.createElement("a");

      link.href = "data:application/pdf;base64," + base64;
      link.download = outsource + "_Payroll.pdf";

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);
    })
    .generatePayrollPDF(outsource, from, to);
}





function markPaymentDone() {

  const from = document.getElementById("fromDateTime").value;
  const to   = document.getElementById("toDateTime").value;

  if (!from || !to) {
   showDialog("info","Action required","Please select From and To date & time");
    return;
  }

  google.script.run
    .withSuccessHandler(msg => showDialog("success","success",msg))
    .withFailureHandler(err => showDialog("error","error",err.message))
    .processPaymentDone(from, to);
}



function outsourcePaymentDone(){

  var fromInput = document.querySelector('input[id^="from"]');
  var toInput   = document.querySelector('input[id^="to"]');

  if(!fromInput || !toInput){

    showDialog(
      "error",
      "Error",
      "Date inputs not found"
    );

    return;
  }

  var from = fromInput.value;
  var to = toInput.value;

  if(!from || !to){

    showDialog(
      "info",
      "Action required",
      "Please select From and To date & time"
    );

    return;
  }

  showDialog(
    "info",
    "Processing",
    "Updating payment..."
  );

  google.script.run
    .withSuccessHandler(function(msg){

      showDialog("success","Completed",msg);

    })
    .markPaymentDone(from,to);
}






function autoCaseTakenBy() {

  const selectedCourses = Array.from(
    document.querySelectorAll('input[name="courses"]:checked')
  )
  .map(cb => cb.value.trim())
  .filter(Boolean);

  // =====================================
  // COURSE STAFF MAPPING
  // =====================================
  const COURSE_STAFF = {
    "Course Staff 1": "Subha",
    "Course Staff 2": "Sekar"
  };

  // These courses belong to COURSE STAFF 2
  const courseStaff2Courses = [
    "EFA",
    "PSSR",
    "PSSR(A)",
    "BST",
    "STDSD"
  ];

  let caseByList = [];

  selectedCourses.forEach(course => {

    let staffName;

    if (courseStaff2Courses.includes(course)) {

      // Course Staff 2
      staffName = COURSE_STAFF["Course Staff 2"];

    } else {

      // Course Staff 1
      staffName = COURSE_STAFF["Course Staff 1"];

    }

    if (!caseByList.includes(staffName)) {
      caseByList.push(staffName);
    }

  });

  // SHOW ACTUAL NAME IN CASE TAKEN BY
  document.getElementById("caseBy").value =
    caseByList.join(", ");
}


// AUTO RUN WHEN COURSE SELECTED
document.querySelectorAll('input[name="courses"]')
.forEach(cb => {
  cb.addEventListener("change", autoCaseTakenBy);
});




  