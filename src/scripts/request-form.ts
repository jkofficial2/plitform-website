const form = document.querySelector<HTMLFormElement>('#request-form');
if (form) {
  const name = form.querySelector<HTMLInputElement>('[name="name"]')!;
  const contact = form.querySelector<HTMLInputElement>('[name="contact"]')!;
  const category = form.querySelector<HTMLSelectElement>('[name="category"]')!;
  const order = form.querySelector<HTMLTextAreaElement>('[name="order"]')!;
  const city = form.querySelector<HTMLInputElement>('[name="city"]')!;
  const comment = form.querySelector<HTMLTextAreaElement>('[name="comment"]')!;
  const result = document.querySelector<HTMLElement>('#prepared-request')!;
  const output = document.querySelector<HTMLTextAreaElement>('#request-text')!;
  const status = document.querySelector<HTMLElement>('#copy-status')!;
  const mail = document.querySelector<HTMLAnchorElement>('#open-email');
  const subject = 'Запрос цены на бетонные плиты';
  const chosen = new URLSearchParams(window.location.search).get('category');
  if (chosen && [...category.options].some(option => option.value === chosen)) category.value = chosen;
  form.noValidate = true;
  form.querySelector<HTMLButtonElement>('#prepare-button')!.disabled = false;

  function validate(field: HTMLInputElement | HTMLTextAreaElement): boolean {
    const value = field.value.trim();
    let message = '';
    if (field === name && !value) message = 'Укажите, как к вам обращаться.';
    if (field === contact) {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const isPhone = /^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 10 && value.replace(/\D/g, '').length <= 15;
      if (!value) message = 'Укажите телефон или email для ответа.';
      else if (!isEmail && !isPhone) message = 'Введите email или телефон с кодом города, не менее 10 цифр.';
    }
    if (field === order && !value) message = 'Кратко опишите, какие плиты и сколько нужно.';
    const errorId = field === name ? 'name-error' : field === contact ? 'contact-error' : 'order-error';
    document.getElementById(errorId)!.textContent = message;
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
    return !message;
  }

  [name, contact, order].forEach(field => {
    field.addEventListener('blur', () => { if (field.value || field.hasAttribute('aria-invalid')) validate(field); });
    field.addEventListener('input', () => { if (field.hasAttribute('aria-invalid')) validate(field); });
  });
  form.addEventListener('input', () => { result.hidden = true; status.textContent = ''; });
  form.addEventListener('change', () => { result.hidden = true; status.textContent = ''; });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const invalid = [name, contact, order].filter(field => !validate(field));
    if (invalid.length) { invalid[0].focus(); return; }
    const body = [
      'Здравствуйте!', '', 'Прошу сообщить цену и сроки поставки бетонных плит.', '',
      `Имя: ${name.value.trim()}`,
      `Контакт для ответа: ${contact.value.trim()}`,
      `Вид плит: ${category.value ? category.selectedOptions[0].text : 'Указан в описании заказа'}`,
      '', 'Количество, размеры и описание заказа:', order.value.trim(),
      ...(city.value.trim() ? ['', `Город доставки: ${city.value.trim()}`] : []),
      ...(comment.value.trim() ? ['', 'Комментарий:', comment.value.trim()] : []),
      '', 'Прошу уточнить характеристики, наличие и необходимые документы.',
    ].join('\n');
    output.value = body;
    if (mail && form.dataset.recipient && form.dataset.demo === 'false') {
      mail.href = `mailto:${form.dataset.recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
    result.hidden = false;
    status.textContent = '';
    document.getElementById('prepared-heading')!.focus();
  });

  document.getElementById('copy-request')!.addEventListener('click', async () => {
    const text = `Тема: ${subject}\n\n${output.value}`;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      status.textContent = 'Заявка скопирована. Вставьте её в письмо.';
    } catch {
      output.focus(); output.select();
      status.textContent = 'Автоматическое копирование недоступно. Текст выделен: нажмите Ctrl+C или ⌘C либо выберите «Копировать».';
    }
  });
}
