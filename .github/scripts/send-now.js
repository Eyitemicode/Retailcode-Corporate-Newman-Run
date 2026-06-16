"use strict";
const nodemailer = require("nodemailer");
const fs         = require("fs");
const os         = require("os");
const path       = require("path");

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

if (!GMAIL_USER || !GMAIL_PASS) {
  console.error("Set GMAIL_USER and GMAIL_PASS environment variables.");
  process.exit(1);
}

const htmlBody   = fs.readFileSync(path.join(os.tmpdir(), "email-body.html"), "utf8");
const subject    = fs.readFileSync(path.join(os.tmpdir(), "email-subject.txt"), "utf8").trim();
const attachment = path.resolve("./reports/RetailCode-Corporate-Test-Report.html");

const transporter = nodemailer.createTransport({
  host:   "smtp.gmail.com",
  port:   465,
  secure: true,
  auth:   { user: GMAIL_USER, pass: GMAIL_PASS },
  tls:    { rejectUnauthorized: false }
});

const mailOptions = {
  from:    "RetailCode QA Bot <" + GMAIL_USER + ">",
  to:      "oladimeji.ajayi@fbistech.com, osayuki.aganmwonyi@fbistech.com, stanislaus.odili@fbistech.com, gift.alabo@fbistech.com",
  cc:      "eyitemi.abioritsegbemi@fbistech.com",
  subject: subject,
  html:    htmlBody,
  attachments: [
    { filename: "RetailCode-Corporate-Test-Report.html", path: attachment }
  ]
};

transporter.sendMail(mailOptions, function(err, info) {
  if (err) {
    console.error("Send failed:", err.message);
    process.exit(1);
  }
  console.log("Email sent:", info.messageId);
  console.log("Accepted:", info.accepted);
});
