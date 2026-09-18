const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

process.env.TZ = process.env.TZ || 'Asia/Kolkata';
const app = express();
const PORT = Number(process.env.PORT || 3000);
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '13f2H-_vGf6K2flQnSrgaxeHZ3ejR0Bu9vtx5DFfBujU';

app.use(express.json({limit:'35mb'}));

// Optional Basic Auth. Set BASIC_AUTH_USER/PASS in Railway if this site should be private.
app.use((req,res,next) => {
  const u=process.env.BASIC_AUTH_USER, p=process.env.BASIC_AUTH_PASS;
  if (!u || !p || req.path === '/health') return next();
  const h=req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const [uu,pp] = Buffer.from(h.slice(6),'base64').toString().split(':');
    if (uu===u && pp===p) return next();
  }
  res.set('WWW-Authenticate','Basic realm="MM-EL"');
  res.status(401).send('Authentication required');
});

function envServiceAccount(){
  const raw=process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if(!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing in Railway Variables');
  let obj;
  try { obj=JSON.parse(raw); } catch(e){ throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON'); }
  if(obj.private_key) obj.private_key=obj.private_key.replace(/\\n/g,'\n');
  return obj;
}
function getSheets(){
  const c=envServiceAccount();
  const auth=new google.auth.JWT({email:c.client_email,key:c.private_key,scopes:['https://www.googleapis.com/auth/spreadsheets']});
  return google.sheets({version:'v4',auth});
}
async function values(range, render='FORMATTED_VALUE'){
  const s=getSheets();
  const r=await s.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range,valueRenderOption:render,dateTimeRenderOption:'FORMATTED_STRING'});
  return r.data.values || [];
}
async function update(range, vals){
  const s=getSheets();
  await s.spreadsheets.values.update({spreadsheetId:SPREADSHEET_ID,range,valueInputOption:'USER_ENTERED',requestBody:{values:vals}});
}
async function append(sheet, row){
  const s=getSheets();
  await s.spreadsheets.values.append({spreadsheetId:SPREADSHEET_ID,range:`'${sheet}'!A:A`,valueInputOption:'USER_ENTERED',insertDataOption:'INSERT_ROWS',requestBody:{values:[row]}});
}
async function sheetId(name){
  const s=getSheets();
  const r=await s.spreadsheets.get({spreadsheetId:SPREADSHEET_ID,fields:'sheets.properties'});
  const sh=(r.data.sheets||[]).find(x=>x.properties.title===name);
  if(!sh) throw new Error(`Sheet ${name} not found`);
  return sh.properties.sheetId;
}
async function deleteRow(sheet,row1){
  const s=getSheets(); const sid=await sheetId(sheet);
  await s.spreadsheets.batchUpdate({spreadsheetId:SPREADSHEET_ID,requestBody:{requests:[{deleteDimension:{range:{sheetId:sid,dimension:'ROWS',startIndex:row1-1,endIndex:row1}}}]}});
}
function norm(v){return String(v??'').trim();}
function normIndos(v){return norm(v).toUpperCase().replace(/\s+/g,'');}
function headers(row){return (row||[]).map(h=>norm(h).toLowerCase().replace(/[^a-z0-9]/g,''));}
function col(h,...names){for(const n of names){const i=h.indexOf(n);if(i>=0)return i;}return -1;}
function nowString(){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(',','');}
function parseDateCell(v){
  if(v instanceof Date) return v;
  const s=norm(v); if(!s) return null;
  let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m){ const a=+m[1],b=+m[2],y=+m[3]; const month=a>12?b:a; const day=a>12?a:b; return new Date(y,month-1,day,+(m[4]||0),+(m[5]||0),+(m[6]||0)); }
  const d=new Date(s); return isNaN(d)?null:d;
}
function courseHoursMap(data){const o={}; for(let i=1;i<data.length;i++) o[norm(data[i][0]).toUpperCase()]=Number(data[i][1])||0; return o;}
function transporter(){
  if(!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('SMTP_USER/SMTP_PASS are missing in Railway Variables');
  return nodemailer.createTransport({host:process.env.SMTP_HOST||'smtp.gmail.com',port:Number(process.env.SMTP_PORT||465),secure:String(process.env.SMTP_SECURE||'true')!=='false',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
}
async function sendMail({to,subject,html,text,attachments=[]}){
  return transporter().sendMail({from:{name:process.env.MAIL_FROM_NAME||'Mariners Mentor',address:process.env.MAIL_FROM||process.env.SMTP_USER},to,subject,text:text||'',html,attachments});
}

async function saveLinkToELData(obj){
  const d=await values("'New EL DATA'!A:S"); const target=normIndos(obj.indos);
  for(let i=1;i<d.length;i++) if(normIndos(d[i][2])===target){await update(`'New EL DATA'!S${i+1}`,[[obj.link||'']]);return 'Link saved';}
  throw new Error('INDOS NO not found in EL DATA');
}
function makeRow(data){return [data.name||'',data.dob||'',normIndos(data.indos),data.indospw||'',data.contact||'',data.username||'',data.elpwd||'',data.paymentMode||'',data.money||'',data.caseBy||'',data.enrolledBy||'',data.followedBy||'',data.status||'',data.certificate||'',data.courses||'',nowString(),data.courseBooking||'',data.agentName||'',data.link||''];}
async function savePSSR(data){
  if(!normIndos(data.indos)) throw new Error('INDOS missing');
  if(norm(data.caseBy).toLowerCase()==='sankari') data.caseBy='Sekar';
  const status=norm(data.status).toLowerCase(), indos=normIndos(data.indos), row=makeRow(data);
  if(status==='issued'||status==='completed'){
    if(status==='completed') row[12]='Completed';
    while(row.length<22) row.push(''); row[21]=nowString(); // V Completed Date
    await append('COMPLETED',row);
    const d=await values("'New EL DATA'!A:S");
    for(let i=d.length-1;i>=1;i--) if(normIndos(d[i][2])===indos){await deleteRow('New EL DATA',i+1);break;}
    return 'MOVED TO COMPLETED';
  }
  const d=await values("'New EL DATA'!A:S");
  for(let i=1;i<d.length;i++) if(normIndos(d[i][2])===indos){await update(`'New EL DATA'!A${i+1}:S${i+1}`,[row]);return 'UPDATED IN EL DATA';}
  await append('New EL DATA',row); return 'SAVED IN EL DATA';
}
async function submitEL(data){return savePSSR(data);}
async function markCompleted(indos){
  indos=normIndos(indos); if(!indos) throw new Error('INDOS missing');
  const d=await values("'New EL DATA'!A:W");
  for(let i=1;i<d.length;i++) if(normIndos(d[i][2])===indos){const r=[...d[i]]; while(r.length<23)r.push('');r[12]='Completed';r[21]=nowString();await append('COMPLETED',r);await deleteRow('New EL DATA',i+1);return 'Moved to COMPLETED';}
  throw new Error('INDOS not found in New EL DATA');
}
async function searchSheet(sheet,indos){
  const d=await values(`'${sheet}'!A:W`); if(d.length<2)return null; const h=headers(d[0]);
  const c={name:col(h,'name'),dob:col(h,'dob'),indos:col(h,'indosno','indos','indosnumber'),indospw:col(h,'indospw','indospassword'),contact:col(h,'contact','mobileno','phone'),username:col(h,'username','email'),elpwd:col(h,'elpwd','elpassword'),money:col(h,'money','payment','amount'),paymentMode:col(h,'paymentmode','modeofpayment'),caseBy:col(h,'casetakenby','caseby'),enrolledBy:col(h,'enrolledby'),followedBy:col(h,'followedby'),status:col(h,'status'),certificate:col(h,'certificate','iscertificateissued'),courses:col(h,'courses'),courseBooking:col(h,'coursebooking'),agentName:col(h,'agent','agentname'),link:col(h,'link','documentlink')};
  if(c.indos<0)return null;
  for(let i=1;i<d.length;i++)if(normIndos(d[i][c.indos])===indos){const x={};for(const [k,j] of Object.entries(c))x[k]=j>=0?(d[i][j]||''):'';x.indos=indos;return x;} return null;
}
async function searchByIndos(indos){indos=normIndos(indos);if(!indos)return{found:false};for(const s of ['New EL DATA','EL DATA','COMPLETED']){const r=await searchSheet(s,indos);if(r)return{found:true,row:r};}return{found:false};}
async function checkIndos(indos){indos=normIndos(indos);for(const s of ['EL DATA','New EL DATA']){const d=await values(`'${s}'!A:W`);for(let i=1;i<d.length;i++)if(normIndos(d[i][2])===indos)return{found:true,sheet:s,row:i+1,courses:d[i][14]||''};}return{found:false};}
async function addCourseToExisting(info,newCourses){const d=await values(`'${info.sheet}'!O${info.row}`);const existing=norm(d[0]?.[0]).split(',').map(x=>x.trim()).filter(Boolean);for(const c of newCourses||[])if(!existing.includes(c))existing.push(c);await update(`'${info.sheet}'!O${info.row}`,[[existing.join(', ')]]);return '✅ Course Added Successfully';}
async function getStaffPhone(name){return getPhoneFromContacts(name);}
async function getPhoneFromContacts(name){const d=await values("'CONTACTS'!A:C");const n=norm(name).toLowerCase();for(let i=1;i<d.length;i++)if(norm(d[i][0]).toLowerCase()===n)return norm(d[i][1]).replace(/\D/g,'');return '';}
async function getOutsourcePhone(name){let p=await getPhoneFromContacts(name);if(p.length===10)p='91'+p;return p;}
async function markCertificateIssued(rowIndex){await update(`'COMPLETED'!M${rowIndex}:N${rowIndex}`,[['Issued','Yes']]);await update(`'COMPLETED'!W${rowIndex}`,[[nowString()]]);return 'Certificate issued successfully';}
async function getCompletedForCertificate(){const d=await values("'COMPLETED'!A:W");if(d.length<2)return[];const h=headers(d[0]),ci=col(h,'status'),ii=col(h,'indosno','indos'),di=col(h,'dob'),ei=col(h,'enrolledby'),dt=col(h,'datetime'),co=col(h,'courses'),em=col(h,'username','email');const out=[];for(let i=1;i<d.length;i++)if(norm(d[i][ci]).toLowerCase()==='completed')out.push({rowIndex:i+1,indos:d[i][ii]||'',dob:d[i][di]||'',enrolledBy:d[i][ei]||'',status:d[i][ci]||'',datetime:d[i][dt]||'',courses:d[i][co]||'',email:d[i][em]||''});return out;}
async function getCompletedForUI(){const d=await getCompletedForCertificate();return d.map(r=>({indos:r.indos,status:r.status,courses:r.courses}));}
async function getCompletedPage(page,size){const d=await getCompletedForCertificate();size=Number(size)||10;page=Math.max(1,Number(page)||1);const totalPages=Math.max(1,Math.ceil(d.length/size));const start=(page-1)*size;return{page,totalPages,rows:d.slice(start,start+size)};}
async function getContactByRow(row){const d=await values(`'COMPLETED'!E${row}`);return norm(d[0]?.[0]).replace(/\D/g,'');}
async function sendCertificateWithAttachment(obj){
  const d=await values("'COMPLETED'!A:F");let name='Candidate';for(let i=1;i<d.length;i++)if(norm(d[i][5]).toLowerCase()===norm(obj.email).toLowerCase()){name=d[i][0]||name;break;}
  const b64=String(obj.data||'').split(',').pop(); if(!b64)throw new Error('Certificate PDF data missing');
  await sendMail({to:obj.email,subject:'DG-Shipping Certificate',html:`<div style="font-family:Arial;line-height:1.6"><p style="color:blue;font-size:22px;font-weight:bold">Dear ${escapeHtml(name)},</p><p>Please find attached DG - Shipping Certificate.</p><p><b style="color:red">Course Name :</b> ${escapeHtml(obj.course||'')}</p><br><p><b>Stay Connected with us:</b></p><p><a href="https://www.facebook.com/mariners.mentor.16">Facebook</a> &nbsp; <a href="https://www.instagram.com/mariners_mentor_tuty">Instagram</a></p><p>With regards,<br><b style="color:darkgreen">Mariners Mentor</b></p></div>`,attachments:[{filename:obj.filename||'certificate.pdf',content:Buffer.from(b64,'base64'),contentType:'application/pdf'}]});
  return 'Certificate Mailed successfully';
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function sendPhotoToFollowedBy(name,followedBy,base64Data,fileName){const d=await values("'CONTACTS'!A:C");let email='';for(let i=1;i<d.length;i++)if(norm(d[i][0])===norm(followedBy)){email=norm(d[i][2]);break;}if(!email)throw new Error('Email not found for '+followedBy);await sendMail({to:email,subject:name||'Candidate Photo',text:'Please find the attached photo.',attachments:[{filename:fileName||'photo.jpg',content:Buffer.from(base64Data,'base64'),contentType:'image/jpeg'}]});return true;}
async function getOutsourceTimeByDate(from,to){const [d,c]=await Promise.all([values("'COMPLETED'!A:W"),values("'COURSES'!A:B")]);const map=courseHoursMap(c),a=new Date(from+'T00:00:00'),b=new Date(to+'T23:59:59'),r={};for(let i=1;i<d.length;i++){const who=norm(d[i][11]),courses=norm(d[i][14]),dt=parseDateCell(d[i][21]);if(!who||!courses||!dt||dt<a||dt>b)continue;let h=0;for(const x of courses.split(','))h+=map[norm(x).toUpperCase()]||0;r[who]=(r[who]||0)+h;}return Object.keys(r).sort().map(outsource=>({outsource,hours:r[outsource]}));}
async function getPayrollData(outsource,from,to){const [d,c]=await Promise.all([values("'COMPLETED'!A:W"),values("'COURSES'!A:B")]);const map=courseHoursMap(c),a=new Date(from+'T00:00:00'),b=new Date(to+'T23:59:59'),rows=[];let totalHours=0;for(let i=1;i<d.length;i++){const who=norm(d[i][11]),course=norm(d[i][14]),dt=parseDateCell(d[i][21]);if(who!==outsource||!dt||dt<a||dt>b)continue;const hrs=map[course.toUpperCase()]||0;totalHours+=hrs;rows.push({name:d[i][0]||'',indos:d[i][2]||'',course,date:dt.toLocaleDateString('en-GB'),hours:hrs});}return{rows,totalHours,fromDate:new Date(from+'T00:00:00').toLocaleDateString('en-GB'),toDate:new Date(to+'T00:00:00').toLocaleDateString('en-GB'),downloadedOn:nowString()};}
async function generatePayrollPDF(outsource,from,to){const data=await getPayrollData(outsource,from,to);return await pdfBase64(data,outsource);}
function pdfBase64(data,outsource){return new Promise((resolve,reject)=>{const doc=new PDFDocument({margin:36,size:'A4'}),chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks).toString('base64')));doc.on('error',reject);doc.fontSize(24).fillColor('#1b7f3a').text('MARINERS MENTOR',{align:'center'});doc.fillColor('#000').fontSize(13).text('OUTSOURCE PAYROLL STATEMENT',{align:'center'}).moveDown();doc.fontSize(10).text(`Outsource Name: ${outsource}`).text(`Working Period: ${data.fromDate} to ${data.toDate}`).moveDown();const widths=[120,90,135,90,55],heads=['Name','INDoS.No','Course','Date','Hours'];let x=36,y=doc.y;function cell(txt,w,bold=false){doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(8).text(String(txt??''),x,y,{width:w-4,height:22,align:'center'});x+=w;}x=36;heads.forEach((h,i)=>cell(h,widths[i],true));y+=24;for(const r of data.rows){if(y>750){doc.addPage();y=40;}x=36;[r.name,r.indos,r.course,r.date,r.hours].forEach((v,i)=>cell(v,widths[i]));y+=22;}doc.moveDown().font('Helvetica-Bold').fontSize(10).text(`Total Working Hours (${data.fromDate} to ${data.toDate}): ${data.totalHours}`);doc.moveDown().font('Helvetica').fontSize(8).text(`Downloaded on: ${data.downloadedOn}`,{align:'right'}).text('This is a system-generated payroll statement.',{align:'right'});doc.end();});}
async function processPaymentDone(from,to){const d=await values("'COMPLETED'!A:Y");const a=new Date(from+'T00:00:00'),b=new Date(to+'T23:59:59');const month=a.toLocaleString('en-US',{month:'short',year:'numeric'}).toUpperCase();const dest=`PAID - ${month}`;const meta=getSheets();try{await sheetId(dest);}catch{await meta.spreadsheets.batchUpdate({spreadsheetId:SPREADSHEET_ID,requestBody:{requests:[{addSheet:{properties:{title:dest}}}]}});if(d[0])await append(dest,d[0]);}const dels=[];let count=0;for(let i=1;i<d.length;i++){const dt=parseDateCell(d[i][15]);if(!dt||dt<a||dt>b)continue;const row=[...d[i]];while(row.length<25)row.push('');row[20]='Payment Done';await append(dest,row);dels.push(i+1);count++;}for(const r of dels.sort((a,b)=>b-a))await deleteRow('COMPLETED',r);return count?`✅ ${count} rows moved using Completed Date & Time`:'No completed records in selected date & time range';}
async function markPaymentDone(from,to){const d=await values("'COMPLETED'!A:Y");const a=new Date(from+'T00:00:00'),b=new Date(to+'T23:59:59');let n=0;for(let i=1;i<d.length;i++){const dt=parseDateCell(d[i][21]);if(dt&&dt>=a&&dt<=b){await update(`'COMPLETED'!Y${i+1}`,[['Payment Done']]);n++;}}return `Payment Done updated (${n})`;}
async function updateAlreadyEnrolled(){return true;}

const handlers={saveLinkToELData,savePSSR,submitEL,markCompleted,searchByIndos,checkIndos,addCourseToExisting,getStaffPhone,getOutsourcePhone,markCertificateIssued,sendCertificateWithAttachment,getCompletedForCertificate,getCompletedForUI,getCompletedPage,getContactByRow,sendPhotoToFollowedBy,getOutsourceTimeByDate,getPayrollData,generatePayrollPDF,processPaymentDone,markPaymentDone,updateAlreadyEnrolled};
app.post('/api/el/call',async(req,res)=>{try{const {fn,args=[]}=req.body||{};if(!handlers[fn])return res.status(404).json({ok:false,error:`Unknown function: ${fn}`});const result=await handlers[fn](...(Array.isArray(args)?args:[]));res.json({ok:true,result});}catch(e){console.error(e);res.status(500).json({ok:false,error:e.message||String(e)});}});

// ===================== MM-OUTSOURCE BACKEND =====================
const OUT_ENROLL_CONTACTS = {
  NOBLE: '7550191470', SANKARI: '7550191470', SAROMIAH: '7550191470', SEKAR: '7550191470'
};
function outHeaderKey(v){ return norm(v).toLowerCase().replace(/[^a-z0-9]/g,''); }
function outNormalize(v){ return norm(v).toUpperCase().replace(/[^A-Z0-9]/g,''); }
function outInputDate(v){ const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m) throw new Error('Invalid date'); return new Date(+m[1],+m[2]-1,+m[3]); }
function toA1Column(n){ let s=''; while(n>0){ n--; s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26);} return s; }

async function outValidateStaff(username,passkey){
  const d=await values("'CONTACTS'!A:D"); username=norm(username).toLowerCase(); passkey=norm(passkey);
  for(let i=1;i<d.length;i++) if(norm(d[i][2]).toLowerCase()===username && norm(d[i][3])===passkey) return norm(d[i][0]);
  return '';
}
async function outGetTimeChartData(passkey,fromDate,toDate){
  if(!fromDate||!toDate) throw new Error('Please select From and To date');
  const [contacts,courses,completed]=await Promise.all([values("'CONTACTS'!A:D"),values("'COURSES'!A:B"),values("'COMPLETED'!A:V")]);
  let staff=''; for(let i=1;i<contacts.length;i++) if(norm(contacts[i][3])===norm(passkey)){staff=norm(contacts[i][0]);break;}
  if(!staff) throw new Error('Invalid Passkey');
  const hours={}; for(let i=1;i<courses.length;i++) hours[outNormalize(courses[i][0])]=Number(courses[i][1])||0;
  const a=outInputDate(fromDate); a.setHours(0,0,0,0); const b=outInputDate(toDate); b.setHours(23,59,59,999);
  const out=[]; for(let i=1;i<completed.length;i++){ if(norm(completed[i][11])!==staff) continue; const dt=parseDateCell(completed[i][21]); if(!dt||dt<a||dt>b) continue; const c=norm(completed[i][14]); out.push([completed[i][0]||'',c,hours[outNormalize(c)]||0,new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric'}).format(dt).replaceAll('/','-')]); }
  return out;
}
async function outGetCoursesByIndos(indos){
  indos=norm(indos).toUpperCase(); if(!indos) return [];
  for(const sh of ['EL DATA','New EL DATA']){ const d=await values(`'${sh}'!A:Z`); if(d.length<2) continue; const h=d[0].map(outHeaderKey), ic=h.indexOf('indosno'), cc=h.indexOf('courses'); if(ic<0||cc<0) continue; for(let i=1;i<d.length;i++) if(norm(d[i][ic]).toUpperCase()===indos) return norm(d[i][cc]).split(',').map(x=>x.trim()).filter(Boolean); }
  return [];
}
async function outLocateIndos(indos){
  indos=norm(indos).toUpperCase();
  for(const sh of ['EL DATA','New EL DATA']){ const d=await values(`'${sh}'!A:Z`); if(d.length<2) continue; const h=d[0].map(outHeaderKey), ic=h.indexOf('indosno'), cc=h.indexOf('courses'), sc=h.indexOf('status'); if(ic<0||cc<0) continue; for(let i=1;i<d.length;i++) if(norm(d[i][ic]).toUpperCase()===indos) return {sheetName:sh,data:d,headers:h,rowIndex:i+1,row:d[i],indosCol:ic,courseCol:cc,statusCol:sc}; }
  return null;
}
async function outStaffOk(username,passkey,indos,course){
  if(!username||!passkey||!indos||!course) throw new Error('All fields are required');
  username=norm(username).toLowerCase(); passkey=norm(passkey); indos=norm(indos).toUpperCase(); course=norm(course);
  const staff=await outValidateStaff(username,passkey); if(!staff) throw new Error('Invalid Email or Passkey');
  const loc=await outLocateIndos(indos); if(!loc) throw new Error('INDOS not found in EL DATA or New EL DATA');
  const courses=norm(loc.row[loc.courseCol]).split(',').map(x=>x.trim()).filter(Boolean); if(!courses.includes(course)) throw new Error('Course not found for this INDOS');
  // COMPLETED is kept only as backend history for payroll/time-chart. It is NOT shown as a website tab.
  const hist=await values("'COMPLETED'!A:V");
  for(let j=1;j<hist.length;j++) if(norm(hist[j][2]).toUpperCase()===indos && norm(hist[j][14])===course) throw new Error('Already completed entry exists');
  const row=[...loc.row]; while(row.length<22) row.push(''); row[loc.courseCol]=course; if(loc.statusCol>=0) row[loc.statusCol]='Completed'; row[21]=nowString(); await append('COMPLETED',row);
  const remaining=courses.filter(c=>c!==course);
  if(!remaining.length) await deleteRow(loc.sheetName,loc.rowIndex); else { await update(`'${loc.sheetName}'!${toA1Column(loc.courseCol+1)}${loc.rowIndex}`,[[remaining.join(', ')]]); if(loc.statusCol>=0) await update(`'${loc.sheetName}'!${toA1Column(loc.statusCol+1)}${loc.rowIndex}`,[['Pending']]); }
  const enrolled=norm(loc.row[10]).toUpperCase(); let phone=(OUT_ENROLL_CONTACTS[enrolled]||'').replace(/\D/g,'').slice(-10); let whatsapp=''; if(phone){const msg=`INDoS No: ${indos}\nCourse Name: ${course}\n\nThe course is successfully completed.`; whatsapp=`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;}
  return {message:'Course completed successfully ✔',whatsapp};
}
async function outGetAllocatedCourses(username,passkey){
  const staff=await outValidateStaff(username,passkey); if(!staff) throw new Error('Invalid login'); const out=[];
  for(const sh of ['EL DATA','New EL DATA']){ const d=await values(`'${sh}'!A:Z`); if(d.length<2) continue; const h=d[0].map(outHeaderKey), ic=h.indexOf('indosno'), cc=h.indexOf('courses'), fc=h.indexOf('followedby'); if(ic<0||cc<0||fc<0) continue; for(let i=1;i<d.length;i++){ if(norm(d[i][fc]).toLowerCase()!==staff.toLowerCase()) continue; const ind=norm(d[i][ic]); norm(d[i][cc]).split(',').map(x=>x.trim()).filter(Boolean).forEach(c=>out.push({indos:ind,course:c})); } }
  return out;
}
function outSendWhatsApp(phone,message){ phone=String(phone||'').replace(/\D/g,'').slice(-10); return `https://wa.me/91${phone}?text=${encodeURIComponent(message||'')}`; }
const outsourceHandlers={getTimeChartData:outGetTimeChartData,getCoursesByIndos:outGetCoursesByIndos,staffOk:outStaffOk,getAllocatedCourses:outGetAllocatedCourses,sendWhatsApp:outSendWhatsApp};

app.post('/api/outsource/call',async(req,res)=>{try{const {fn,args=[]}=req.body||{};if(!outsourceHandlers[fn])return res.status(404).json({ok:false,error:`Unknown function: ${fn}`});const result=await outsourceHandlers[fn](...(Array.isArray(args)?args:[]));res.json({ok:true,result});}catch(e){console.error(e);res.status(500).json({ok:false,error:e.message||String(e)});}});

app.get('/health',(req,res)=>res.status(200).json({ok:true,service:'MM-Merged',time:new Date().toISOString()}));

// Home -> MM-EL
app.get('/',(req,res)=>res.redirect('/el/'));

// Keep clean URLs with a trailing slash.
app.get('/el',(req,res)=>res.redirect('/el/'));
app.get('/outsource',(req,res)=>res.redirect('/outsource/'));

// Serve both frontends.
app.use('/el',express.static(path.join(__dirname,'public','el')));
app.use('/outsource',express.static(path.join(__dirname,'public','outsource')));

// Express 4/5-safe SPA fallbacks. Do NOT use app.get('*') or '/el/*'.
app.get(/^\/el\/.*$/, (req,res)=>
  res.sendFile(path.join(__dirname,'public','el','index.html'))
);
app.get(/^\/outsource\/.*$/, (req,res)=>
  res.sendFile(path.join(__dirname,'public','outsource','index.html'))
);

// Final 404 fallback.
app.use((req,res)=>res.status(404).send('Page not found'));

app.listen(PORT,'0.0.0.0',()=>console.log(`MM merged Railway server listening on ${PORT}`));
