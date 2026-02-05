const form = document.getElementById('reservationForm');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const ticketPreview = document.getElementById('ticketPreview');
const ticketCode = document.getElementById('ticketCode');
const checkInLink = document.getElementById('checkInLink');
const qrImage = document.getElementById('qrImage');
const ticketTypeSelect = document.getElementById('ticketType');
const selectedPrice = document.getElementById('selectedPrice');
const paymentAmountInput = document.getElementById('paymentAmount');

const priceMap = {
  standing: 1500,
  group: 5000,
  vip: 5000
};

function updatePrice() {
  const ticketType = ticketTypeSelect.value;
  const amount = priceMap[ticketType] || 0;
  selectedPrice.textContent = `EGP ${amount.toLocaleString()}`;
  paymentAmountInput.value = String(amount);
}

ticketTypeSelect.addEventListener('change', updatePrice);
updatePrice();

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
    ticketCode.textContent = `Ticket: ${data.ticketCode} | ${data.ticketType} | EGP ${Number(data.paymentAmount || 0).toLocaleString()}`;
    checkInLink.textContent = data.checkInUrl ? `Organizer check-in URL: ${data.checkInUrl}` : '';
    qrImage.src = data.qrCodeDataUrl;
    form.reset();
    updatePrice();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
  }
});
