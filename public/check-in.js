const form = document.getElementById('checkInForm');
const resultMessage = document.getElementById('resultMessage');
const ticketCodeInput = document.getElementById('ticketCodeInput');

const pathTicketCode = window.location.pathname.split('/').pop();
if (pathTicketCode && pathTicketCode.startsWith('7ALA-')) {
  ticketCodeInput.value = decodeURIComponent(pathTicketCode);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  resultMessage.textContent = 'Validating ticket...';

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/api/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Check-in failed.');
    }

    resultMessage.textContent = `${data.message} Guest: ${data.guestName}`;
  } catch (error) {
    resultMessage.textContent = error.message;
  }
});
