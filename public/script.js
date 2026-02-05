const form = document.getElementById('reservationForm');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const ticketPreview = document.getElementById('ticketPreview');
const ticketCode = document.getElementById('ticketCode');
const checkInLink = document.getElementById('checkInLink');
const qrImage = document.getElementById('qrImage');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.textContent = 'Processing payment confirmation...';
  submitBtn.disabled = true;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Reservation failed');
    }

    message.textContent = 'Reservation successful. QR ticket sent to your email.';
    ticketPreview.classList.remove('hidden');
    ticketCode.textContent = `Ticket: ${data.ticketCode}`;
    if (data.checkInUrl) {
      checkInLink.textContent = `Organizer check-in URL: ${data.checkInUrl}`;
    }
    qrImage.src = data.qrCodeDataUrl;
    form.reset();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
  }
});
