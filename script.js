/**
 * Checkout Progressivo - Script Principal - VERSÃO FINAL CORRIGIDA
 * Fluxo UX otimizado com revelação progressiva de campos
 */

// Estado global do checkout
let currentStep = 2; // Inicia na etapa 2 (Entrega)
let selectedShipping = null;
let selectedPayment = 'pix';
let addressFilled = false;
let pixTimer = null;

window.checkoutData = {};

const CREDIT_CARD_FEE_PERCENTAGE = 50;
const BACKEND_API_BASE_URL = '/api/payments';

let cartData = {
    subtotal: 299.90
};

// Estado do fluxo progressivo
let flowState = {
    emailValid: false,
    cepValid: false,
    shippingSelected: false,
    personalDataValid: false,
    addressComplementValid: false,
    cpfValid: false
};

// Inicialização do EmailJS
(function() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.onload = function() {
        if (typeof emailjs !== 'undefined') {
            emailjs.init("37e70HYkrmbGbVQx9");
        }
    };
    document.head.appendChild(script);
})();

document.addEventListener('DOMContentLoaded', function() {
    parseSubtotalFromURL();
    setupEventListeners();
    updateProgress();
    setupMasks();
    updateCartDisplay();
    initializeProgressiveFlow();

    // Configurar teclado numérico para campos específicos
    const numericFields = ['cpf', 'zipCode', 'phone'];
    numericFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.setAttribute('inputmode', 'numeric');
            field.setAttribute('type', 'text');
        }
    });

    const creditCardNotice = document.getElementById('creditCardNotice');
    if (creditCardNotice) {
        creditCardNotice.style.display = 'none';
    }
});

/**
 * Inicializa o fluxo progressivo
 */
function initializeProgressiveFlow() {
    const sections = [
        'shippingOptions',
        'sectionPersonalData',
        'sectionAddressInfo',
        'sectionAddressComplement',
        'sectionCpf',
        'sectionButton'
    ];

    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('hidden');
            section.classList.remove('show');
        }
    });

    const sectionCep = document.getElementById('sectionCep');
    if (sectionCep) {
        sectionCep.classList.remove('hidden');
    }

    setTimeout(() => {
        const emailField = document.getElementById('email');
        if (emailField) {
            emailField.focus();
        }
    }, 500);
}

function parseSubtotalFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const subtotalParam = urlParams.get('subtotal');
    
    if (subtotalParam) {
        try {
            cartData.subtotal = parseFloat(subtotalParam);
        } catch (error) {
            console.error('Error parsing subtotal from URL:', error);
        }
    }
}

function updateCartDisplay() {
    updateOrderTotals();
}

function updateOrderTotals() {
    const subtotalEl = document.querySelector(".sidebar .total-row span:last-child");
    const mobileSubtotalEl = document.querySelector("#summaryContent .total-row span:nth-child(2)");
    
    if (subtotalEl) {
        subtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    if (mobileSubtotalEl) {
        mobileSubtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    const mobileTotalPrice = document.getElementById("mobileTotalPrice");
    if (mobileTotalPrice) {
        mobileTotalPrice.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    updateShippingCost();
}

function setupEventListeners() {
    // Form submissions - CORREÇÃO: Garantir que o botão de envio chame a função correta
    const deliveryForm = document.getElementById('deliveryForm');
    if (deliveryForm) {
        deliveryForm.addEventListener('submit', handleDeliverySubmit);
    }

    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmit);
    }

    // Shipping options
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.addEventListener('click', selectShipping);
    });

    // Payment methods
    document.querySelectorAll('.payment-method').forEach(method => {
        const header = method.querySelector('.payment-header');
        if (header) {
            header.addEventListener('click', selectPayment);
        }
    });

    // Email field
    const emailField = document.getElementById('email');
    if (emailField) {
        emailField.addEventListener('blur', handleEmailBlur);
        emailField.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
            checkFormCompletion();
        });
    }

    // CEP field
    const zipCodeField = document.getElementById('zipCode');
    if (zipCodeField) {
        zipCodeField.addEventListener('keyup', handleCEPLookup);
        zipCodeField.addEventListener('blur', () => {
            validateField(zipCodeField);
            checkFormCompletion();
        });
    }

    // All form inputs validation
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('blur', () => {
            validateField(input);
            checkFormCompletion();
        });
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
            checkFormCompletion();
        });
    });

    // Personal data fields
    const personalFields = ['firstName', 'lastName', 'phone'];
    personalFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', checkFormCompletion);
            field.addEventListener('input', checkFormCompletion);
        }
    });

    // Address fields
    const addressFields = ['number'];
    addressFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', checkFormCompletion);
            field.addEventListener('input', checkFormCompletion);
        }
    });

    // CPF field
    const cpfField = document.getElementById('cpf');
    if (cpfField) {
        cpfField.addEventListener('blur', checkFormCompletion);
        cpfField.addEventListener('input', checkFormCompletion);
    }
}

function handleEmailBlur() {
    const emailField = document.getElementById('email');
    const isValid = validateField(emailField);
    if (isValid) {
        flowState.emailValid = true;
    }
    checkFormCompletion();
}

function revealSection(sectionId, enableScroll = false) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('show');
        if (enableScroll) {
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

function hideSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('hidden');
        section.classList.remove('show');
    }
}

async function handleCEPLookup() {
    const cepInput = document.getElementById('zipCode');
    const cep = cepInput.value.replace(/\D/g, '');
    
    if (cep.length === 8) {
        cepInput.blur();
        showCEPLoading(true);
        
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            
            if (!data.erro) {
                fillAddressFields(data);
                flowState.cepValid = true;
                revealSection('shippingOptions');
                cepInput.classList.remove('error');
                cepInput.classList.add('success');
            } else {
                showCEPError();
                flowState.cepValid = false;
            }
        } catch (error) {
            showCEPError();
            flowState.cepValid = false;
        } finally {
            showCEPLoading(false);
            checkFormCompletion();
        }
    }
}

function showCEPLoading(show) {
    const loading = document.getElementById('cepLoading');
    if (loading) {
        show ? loading.classList.add('show') : loading.classList.remove('show');
    }
}

function fillAddressFields(data) {
    const fields = {
        'address': data.logradouro,
        'neighborhood': data.bairro,
        'city': data.localidade,
        'state': data.uf
    };

    for (const [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
        
        const display = document.getElementById(`${id}Display`);
        if (display) display.textContent = value || '-';
    }
    
    addressFilled = true;
}

function showCEPError() {
    const zipCodeInput = document.getElementById('zipCode');
    const errorEl = document.getElementById('zipCodeError');
    if (zipCodeInput) {
        zipCodeInput.classList.add('error');
        zipCodeInput.classList.remove('success');
    }
    if (errorEl) {
        errorEl.textContent = 'CEP não encontrado.';
        errorEl.classList.add('show');
    }
}

function selectShipping() {
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    this.classList.add('selected');
    selectedShipping = this.dataset.shipping;
    flowState.shippingSelected = true;
    updateShippingCost();
    
    // Revela tudo de uma vez sem scroll
    revealSection('sectionPersonalData', false);
    revealSection('sectionAddressInfo', false);
    revealSection('sectionAddressComplement', false);
    revealSection('sectionCpf', false); 
    revealSection('sectionButton', false);
    
    checkFormCompletion();
}

/**
 * Função de validação centralizada e habilitação do botão
 * CORREÇÃO: Lógica robusta para garantir que o botão funcione
 */
function checkFormCompletion() {
    const btn = document.getElementById('btnContinuePayment');
    if (!btn) return;
    
    const email = document.getElementById('email')?.value || '';
    const zipCode = document.getElementById('zipCode')?.value || '';
    const firstName = document.getElementById('firstName')?.value || '';
    const lastName = document.getElementById('lastName')?.value || '';
    const phone = document.getElementById('phone')?.value || '';
    const number = document.getElementById('number')?.value || '';
    const cpf = document.getElementById('cpf')?.value || '';
    
    const isEmailValid = validateEmail(email);
    const isZipValid = validateZipCode(zipCode);
    const isShippingSelected = selectedShipping !== null;
    const isNameValid = firstName.trim() !== '' && lastName.trim() !== '';
    const isPhoneValid = validatePhone(phone);
    const isNumberValid = number.trim() !== '';
    const isCpfValid = validateCPF(cpf);
    
    const isComplete = 
        isEmailValid && 
        isZipValid && 
        isShippingSelected && 
        isNameValid && 
        isPhoneValid && 
        isNumberValid && 
        isCpfValid;
    
    // Habilita/Desabilita o botão
    btn.disabled = !isComplete;
    
    // Debug log para ajudar o desenvolvedor se necessário
    console.log('Form Status:', { isEmailValid, isZipValid, isShippingSelected, isNameValid, isPhoneValid, isNumberValid, isCpfValid, isComplete });

    // Garante visibilidade se o frete estiver selecionado
    if (isShippingSelected) {
        const sectionBtn = document.getElementById('sectionButton');
        if (sectionBtn && sectionBtn.classList.contains('hidden')) {
            revealSection('sectionButton', false);
        }
    }
}

function setupMasks() {
    const masks = {
        'cpf': applyCPFMask,
        'phone': applyPhoneMask,
        'zipCode': applyZipMask,
        'cardNumber': applyCardMask,
        'cardExpiry': applyExpiryMask
    };

    for (const [id, maskFn] of Object.entries(masks)) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                e.target.value = maskFn(e.target.value);
            });
        }
    }

    const cardCvv = document.getElementById('cardCvv');
    if (cardCvv) {
        cardCvv.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

function applyCPFMask(value) {
    return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
}

function applyPhoneMask(value) {
    return value.replace(/\D/g, '').replace(/^(\d\d)(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
}

function applyZipMask(value) {
    return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
}

function applyCardMask(value) {
    return value.replace(/\D/g, '').replace(/(\d{4})(\d)/g, '$1 $2').trim().substring(0, 19);
}

function applyExpiryMask(value) {
    return value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').substring(0, 5);
}

function validateField(field) {
    if (!field) return false;
    const value = field.value.trim();
    let isValid = true;
    
    if (field.id === 'email') isValid = validateEmail(value);
    else if (field.id === 'zipCode') isValid = validateZipCode(value);
    else if (field.id === 'cpf') isValid = validateCPF(value);
    else if (field.id === 'phone') isValid = validatePhone(value);
    else if (field.required) isValid = value !== '';
    
    if (!isValid) {
        field.classList.add('error');
        field.classList.remove('success');
    } else {
        field.classList.remove('error');
        field.classList.add('success');
    }
    return isValid;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateZipCode(zip) {
    const digits = zip.replace(/\D/g, '');
    return digits.length === 8;
}

function validatePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 11;
}

function validateCPF(cpf) {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
    let sum = 0, remainder;
    for (let i = 1; i <= 9; i++) sum += parseInt(digits.substring(i-1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(digits.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(digits.substring(i-1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    return remainder === parseInt(digits.substring(10, 11));
}

function updateShippingCost() {
    let shippingCost = 0;
    if (selectedShipping === 'express') shippingCost = 25.00;
    else if (selectedShipping === 'standard') shippingCost = 15.00;
    
    const total = cartData.subtotal + shippingCost;
    const formattedTotal = `R$ ${total.toFixed(2).replace(".", ",")}`;
    const formattedShipping = shippingCost === 0 ? "Grátis" : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`;

    const elements = {
        ".sidebar .total-row:nth-child(2) span:last-child": formattedShipping,
        "#summaryContent .total-row:nth-child(2) span:nth-child(2)": formattedShipping,
        ".sidebar .total-row.final span:last-child": formattedTotal,
        "#summaryContent .total-row.final span:nth-child(2)": formattedTotal,
        "#mobileTotalPrice": formattedTotal
    };

    for (const [selector, value] of Object.entries(elements)) {
        const el = document.querySelector(selector) || document.getElementById(selector.replace('#', ''));
        if (el) el.textContent = value;
    }
}

function selectPayment() {
    const method = this.closest('.payment-method');
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    method.classList.add('selected');
    selectedPayment = method.dataset.payment;
    
    const notice = document.getElementById('creditCardNotice');
    if (notice) notice.style.display = selectedPayment === 'credit_card' ? 'block' : 'none';
}

function updateProgress() {
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        step.classList.toggle('completed', index + 1 < currentStep);
        step.classList.toggle('active', index + 1 === currentStep);
    });
}

async function handleDeliverySubmit(e) {
    e.preventDefault();
    console.log('Iniciando transição para pagamento...');
    
    const formData = new FormData(e.target);
    window.checkoutData.delivery = Object.fromEntries(formData.entries());
    window.checkoutData.delivery.shipping = selectedShipping;
    
    const stepDelivery = document.getElementById('stepDelivery');
    const stepPayment = document.getElementById('stepPayment');
    
    if (stepDelivery && stepPayment) {
        stepDelivery.classList.add('hidden');
        stepPayment.classList.remove('hidden');
        currentStep = 3;
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        console.error('Elementos de etapa não encontrados');
    }
}

async function handlePaymentSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processando...';
    
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (selectedPayment === 'pix') showPixModal();
        else alert('Pedido realizado com sucesso!');
    } catch (error) {
        alert('Erro ao processar pagamento.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function showPixModal() {
    const modal = document.getElementById('pixModal');
    if (modal) {
        modal.classList.add('show');
        startPixTimer(900);
    }
}

function startPixTimer(duration) {
    let timer = duration;
    const display = document.getElementById('pixTimer');
    if (pixTimer) clearInterval(pixTimer);
    pixTimer = setInterval(() => {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        if (display) display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        if (--timer < 0) {
            clearInterval(pixTimer);
            if (display) display.textContent = "Expirado";
        }
    }, 1000);
}

function closePixModal() {
    const modal = document.getElementById('pixModal');
    if (modal) modal.classList.remove('show');
    if (pixTimer) clearInterval(pixTimer);
}

function copyPixCode() {
    const code = "00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865802BR5913MANUS STORE6009SAO PAULO62070503***6304E2B4";
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.btn-copy');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Copiado!';
            setTimeout(() => btn.innerHTML = originalText, 2000);
        }
    });
}
