import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const organizerScanPin = process.env.ORGANIZER_SCAN_PIN || '7777';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

const eventDetails = {
  name: 'ELECTRAMCO',
  date: '07 February',
  timing: '3:00 AM – 12:00 PM',
  lineup: 'Assem | Dizzy | HN2 | Mark | Nour Oden | Big Surprise DJ'
};

const ticketPrices = {
  standing: 1500,
  group: 5000,
  vip: 5000
};

app.post('/api/reservations', async (req, res) => {
  try {
    const { fullName, email, phone, guests, groupType, ticketType, paymentMethod, paymentReference, paymentAmount } = req.body;

    if (!fullName || !email || !phone || !guests || !groupType || !ticketType || !paymentMethod || !paymentReference) {
      return res.status(400).json({ error: 'Please fill all required fields.' });
    }


    if (!ticketPrices[ticketType]) {
      return res.status(400).json({ error: 'Invalid ticket type selected.' });
    }

    if (ticketType === 'vip') {
      return res.status(400).json({ error: 'VIP tables are sold out.' });
    }

    const requiredAmount = ticketPrices[ticketType];
    if (Number(paymentAmount) !== requiredAmount) {
      return res.status(400).json({ error: `Payment amount must be exactly EGP ${requiredAmount} for ${ticketType}.` });
    }

    const reservationId = crypto.randomUUID();
    const ticketCode = `7ALA-${reservationId.slice(0, 8).toUpperCase()}`;
    const checkInUrl = `${baseUrl}/check-in/${ticketCode}`;

    const qrPayload = {
      ticketCode,
      checkInUrl,
      event: eventDetails.name,
      date: eventDetails.date,
      guestName: fullName,
      email,
      guests,
      ticketType,
      paymentAmount: requiredAmount,
      policy: '21+ | Couples and mixed groups only | Selective entry'
    };

    const qrCodeDataUrl = await QRCode.toDataURL(checkInUrl, {
      margin: 1,
      width: 360,
      color: {
        dark: '#efe4c8',
        light: '#0f0c0a'
      }
    });

    if (supabase) {
      const { error } = await supabase.from('reservations').insert({
        reservation_id: reservationId,
        ticket_code: ticketCode,
        full_name: fullName,
        email,
        phone,
        guests,
        group_type: groupType,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        ticket_type: ticketType,
        payment_amount: requiredAmount,
        qr_code_data_url: qrCodeDataUrl,
        qr_payload: qrPayload,
        status: 'paid_pending_review',
        scan_count: 0
      });

      if (error) {
        console.error('Supabase insert error:', error);
      }
    }

    if (transporter) {
      const locationText = 'Meet point: Downtown Cairo, exact pin will be unlocked 12 hours before event by WhatsApp confirmation.';

      const html = `
        <div style="font-family:Arial,sans-serif;background:#111;color:#f6ead1;padding:24px;line-height:1.6;">
          <h2 style="margin:0 0 8px;">Your 7ALA Ticket Is Confirmed ✅</h2>
          <p style="margin:0 0 16px;">Hi ${fullName}, your payment was received. Here is your QR ticket.</p>
          <p><strong>Ticket Code:</strong> ${ticketCode}</p>
          <p><strong>Date:</strong> ${eventDetails.date}</p>
          <p><strong>Timing:</strong> ${eventDetails.timing}</p>
          <p><strong>Lineup:</strong> ${eventDetails.lineup}</p>
          <p><strong>Location:</strong> ${locationText}</p>
          <p><strong>Ticket Type:</strong> ${ticketType.toUpperCase()}</p>
          <p><strong>Paid Amount:</strong> EGP ${requiredAmount}</p>
          <p><strong>Organizer Check-In URL:</strong> ${checkInUrl}</p>
          <div style="margin:20px 0;">
            <img src="cid:qrcode-ticket" alt="QR Ticket" style="width:240px;height:240px;border:1px solid #333;padding:8px;background:#0f0c0a;" />
          </div>
          <p style="font-size:13px;color:#ffcb7c;"><strong>Warning:</strong> Do not share this QR code. Only organizers should scan it at entry.</p>
          <p style="font-size:13px;color:#bda982;">Entry policy: 21+, couples and mixed groups only, selective entry, limited seats.</p>
        </div>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: `Your Ticket for ${eventDetails.name} — ${ticketCode}`,
        html,
        attachments: [
          {
            filename: `${ticketCode}.png`,
            path: qrCodeDataUrl,
            cid: 'qrcode-ticket'
          }
        ]
      });
    }

    res.json({
      success: true,
      message: 'Reservation created. Ticket QR is being sent to email.',
      ticketCode,
      checkInUrl,
      ticketType,
      paymentAmount: requiredAmount,
      qrCodeDataUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong while creating reservation.' });
  }
});

app.post('/api/check-in', async (req, res) => {
  try {
    const { ticketCode, organizerPin } = req.body;

    if (!ticketCode || !organizerPin) {
      return res.status(400).json({ error: 'Ticket code and organizer PIN are required.' });
    }

    if (organizerPin !== organizerScanPin) {
      return res.status(403).json({ error: 'Unauthorized scan attempt. Organizer access only.' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Supabase is not configured on server.' });
    }

    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('id, ticket_code, full_name, status, scanned_at, scan_count')
      .eq('ticket_code', ticketCode)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({ error: 'Could not verify ticket right now.' });
    }

    if (!reservation) {
      return res.status(404).json({ error: 'Invalid ticket. Reservation not found.' });
    }

    if (reservation.scanned_at || Number(reservation.scan_count || 0) > 0 || reservation.status === 'checked_in') {
      return res.status(409).json({
        error: 'This QR ticket was already scanned and cannot be used again.',
        alreadyScanned: true,
        scannedAt: reservation.scanned_at || null
      });
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'checked_in',
        scanned_at: nowIso,
        scan_count: 1
      })
      .eq('id', reservation.id);

    if (updateError) {
      return res.status(500).json({ error: 'Could not mark ticket as scanned.' });
    }

    return res.json({
      success: true,
      ticketCode,
      guestName: reservation.full_name,
      message: 'Check-in successful. This QR is now locked and cannot be scanned again.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unexpected check-in error.' });
  }
});

app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    supabaseConnected: Boolean(supabase),
    emailConfigured: Boolean(transporter)
  });
});

app.get('/check-in/:ticketCode', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'check-in.html'));
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
