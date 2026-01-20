/**
 * Checkout Progressivo - Script Principal - CORRIGIDO
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
        emailjs.init("37e70HYkrmbGbVQx9");
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
 * Mostra apenas a seção de contato inicialmente
 */
function initializeProgressiveFlow() {
    // Esconde todas as seções exceto contato e CEP (ambas visíveis desde o início)
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

    // Garante que a seção de CEP esteja visível
    const sectionCep = document.getElementById('sectionCep');
    if (sectionCep) {
        sectionCep.classList.remove('hidden');
    }

    // Foca no campo de email
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
            console.log('Subtotal loaded from URL:', cartData.subtotal);
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
    // Form submissions
    document.getElementById('deliveryForm').addEventListener('submit', handleDeliverySubmit);
    document.getElementById('paymentForm').addEventListener('submit', handlePaymentSubmit);

    // Shipping options
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.addEventListener('click', selectShipping);
    });

    // Payment methods
    document.querySelectorAll('.payment-method').forEach(method => {
        method.querySelector('.payment-header').addEventListener('click', selectPayment);
    });

    // Email field - Progressive reveal
    const emailField = document.getElementById('email');
    if (emailField) {
        emailField.addEventListener('blur', handleEmailBlur);
        emailField.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    }

    // CEP field
    const zipCodeField = document.getElementById('zipCode');
    if (zipCodeField) {
        zipCodeField.addEventListener('keyup', handleCEPLookup);
        zipCodeField.addEventListener('blur', () => validateField(zipCodeField));
    }

    // All form inputs validation
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
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
            field.addEventListener('blur', checkPersonalDataCompletion);
            field.addEventListener('input', checkPersonalDataCompletion);
        }
    });

    // Address complement fields
    const addressFields = ['number'];
    addressFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', checkAddressCompletion);
            field.addEventListener('input', checkAddressCompletion);
        }
    });

    // CPF field
    const cpfField = document.getElementById('cpf');
    if (cpfField) {
        cpfField.addEventListener('blur', checkCpfCompletion);
        cpfField.addEventListener('input', checkCpfCompletion);
    }
}

/**
 * Manipula o blur do campo de email
 * Apenas valida o email (CEP já está visível desde o início)
 */
function handleEmailBlur() {
    const emailField = document.getElementById('email');
    const isValid = validateField(emailField);
    
    if (isValid && !flowState.emailValid) {
        flowState.emailValid = true;
        // CEP já está visível, não precisa revelar
    }
}

/**
 * Revela uma seção com animação suave
 * @param {string} sectionId - ID da seção a ser revelada
 * @param {boolean} enableScroll - Se true, faz scroll para a seção (padrão: false)
 */
function revealSection(sectionId, enableScroll = false) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('show');
        
        // Scroll suave para a seção (apenas se habilitado)
        if (enableScroll) {
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

/**
 * Esconde uma seção
 */
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
                
                // Revela as opções de frete
                revealSection('shippingOptions');
                
                const errorEl = document.getElementById('zipCodeError');
                errorEl.classList.remove('show');
                cepInput.classList.remove('error');
                cepInput.classList.add('success');
            } else {
                showCEPError();
                flowState.cepValid = false;
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            showCEPError();
            flowState.cepValid = false;
        } finally {
            showCEPLoading(false);
        }
    } else {
        // Esconde seções subsequentes se o CEP for alterado
        if (flowState.cepValid) {
            flowState.cepValid = false;
            flowState.shippingSelected = false;
            hideSection('shippingOptions');
            hideSection('sectionPersonalData');
            hideSection('sectionAddressInfo');
            hideSection('sectionAddressComplement');
            hideSection('sectionCpf');
            hideSection('sectionButton');
            
            // Remove seleção de frete
            document.querySelectorAll('.shipping-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            selectedShipping = null;
        }
        
        const errorEl = document.getElementById('zipCodeError');
        errorEl.classList.remove('show');
        cepInput.classList.remove('error', 'success');
    }
}

function showCEPLoading(show) {
    const loading = document.getElementById('cepLoading');
    if (show) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

function fillAddressFields(data) {
    // Preenche campos ocultos
    document.getElementById('address').value = data.logradouro;
    document.getElementById('neighborhood').value = data.bairro;
    document.getElementById('city').value = data.localidade;
    document.getElementById('state').value = data.uf;
    
    // Preenche displays visuais
    document.getElementById('addressDisplay').textContent = data.logradouro || '-';
    document.getElementById('neighborhoodDisplay').textContent = data.bairro || '-';
    document.getElementById('cityDisplay').textContent = data.localidade || '-';
    document.getElementById('stateDisplay').textContent = data.uf || '-';
    
    addressFilled = true;
}

function showCEPError() {
    const zipCodeInput = document.getElementById('zipCode');
    const errorEl = document.getElementById('zipCodeError');
    
    zipCodeInput.classList.add('error');
    zipCodeInput.classList.remove('success');
    errorEl.textContent = 'CEP não encontrado. Verifique e tente novamente.';
    errorEl.classList.add('show');
    
    // Esconde seções subsequentes
    hideSection('shippingOptions');
    hideSection('sectionPersonalData');
    hideSection('sectionAddressInfo');
    hideSection('sectionAddressComplement');
    hideSection('sectionCpf');
    hideSection('sectionButton');
}

/**
 * Seleciona opção de frete e revela próximas seções
 * CORREÇÃO: Removido scroll automático e pre-seleção de campos
 */
function selectShipping() {
    // Remove seleção anterior
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Adiciona seleção atual
    this.classList.add('selected');
    selectedShipping = this.dataset.shipping;
    
    // Atualiza estado e custos
    flowState.shippingSelected = true;
    updateShippingCost();
    
    // Revela seções de dados pessoais, endereço e CPF (sem scroll)
    // CORREÇÃO: CPF agora é revelado imediatamente junto com os outros campos
    if (!document.getElementById('sectionPersonalData').classList.contains('show')) {
        revealSection('sectionPersonalData', false);
        revealSection('sectionAddressInfo', false);
        revealSection('sectionAddressComplement', false);
        revealSection('sectionCpf', false); 
        revealSection('sectionButton', false); // Botão agora aparece junto com os campos
        
        // CORREÇÃO: Garante que nenhum campo esteja focado ou pré-selecionado para preenchimento
        // Apenas revela as seções, deixando o usuário escolher onde clicar
    }
}

/**
 * Verifica se os dados pessoais estão completos
 */
function checkPersonalDataCompletion() {
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const phone = document.getElementById('phone');
    
    const isValid = 
        firstName.value.trim() !== '' &&
        lastName.value.trim() !== '' &&
        validatePhone(phone.value);
    
    if (isValid && !flowState.personalDataValid) {
        flowState.personalDataValid = true;
    }
    
    checkFormCompletion();
}

/**
 * Verifica se o complemento do endereço está completo
 */
function checkAddressCompletion() {
    const number = document.getElementById('number');
    
    const isValid = number.value.trim() !== '';
    
    if (isValid && !flowState.addressComplementValid) {
        flowState.addressComplementValid = true;
    }
    
    checkFormCompletion();
}

/**
 * Verifica se o CPF está completo e válido
 */
function checkCpfCompletion() {
    const cpf = document.getElementById('cpf');
    const isValid = validateCPF(cpf.value);
    
    if (isValid && !flowState.cpfValid) {
        flowState.cpfValid = true;
        cpf.classList.add('success');
        cpf.classList.remove('error');
        
        // Revela botão de continuar
        revealSection('sectionButton');
    } else if (!isValid && flowState.cpfValid) {
        flowState.cpfValid = false;
    }
    
    checkFormCompletion();
}

/**
 * Verifica se todo o formulário está completo
 * Habilita/desabilita o botão de continuar
 */
function checkFormCompletion() {
    const btn = document.getElementById('btnContinuePayment');
    if (!btn) return;
    
    const email = document.getElementById('email');
    const zipCode = document.getElementById('zipCode');
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const phone = document.getElementById('phone');
    const number = document.getElementById('number');
    const cpf = document.getElementById('cpf');
    
    const isComplete = 
        validateEmail(email.value) &&
        validateZipCode(zipCode.value) &&
        selectedShipping !== null &&
        firstName.value.trim() !== '' &&
        lastName.value.trim() !== '' &&
        validatePhone(phone.value) &&
        number.value.trim() !== '' &&
        validateCPF(cpf.value);
    
    btn.disabled = !isComplete;
    
    // Garante que a seção do botão esteja visível se o frete foi selecionado
    if (selectedShipping !== null && !document.getElementById('sectionButton').classList.contains('show')) {
        revealSection('sectionButton', false);
    }
}

function setupMasks() {
    document.getElementById('cpf').addEventListener('input', function(e) {
        e.target.value = applyCPFMask(e.target.value);
    });

    document.getElementById('phone').addEventListener('input', function(e) {
        e.target.value = applyPhoneMask(e.target.value);
    });

    document.getElementById('zipCode').addEventListener('input', function(e) {
        e.target.value = applyZipMask(e.target.value);
    });

    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) {
        cardNumber.addEventListener('input', function(e) {
            e.target.value = applyCardMask(e.target.value);
        });
    }

    const cardExpiry = document.getElementById('cardExpiry');
    if (cardExpiry) {
        cardExpiry.addEventListener('input', function(e) {
            e.target.value = applyExpiryMask(e.target.value);
        });
    }

    const cardCvv = document.getElementById('cardCvv');
    if (cardCvv) {
        cardCvv.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

function applyCPFMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function applyPhoneMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d\d)(\d)/g, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
}

function applyZipMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{5})(\d)/, '$1-$2');
}

function applyCardMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{4})(\d)/g, '$1 $2')
        .trim();
}

function applyExpiryMask(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '$1/$2')
        .substring(0, 5);
}

function validateField(field) {
    if (!field) return false;
    
    let isValid = true;
    const value = field.value.trim();
    const errorEl = document.getElementById(`${field.id}Error`);
    
    if (field.id === 'email') {
        isValid = validateEmail(value);
    } else if (field.id === 'zipCode') {
        isValid = validateZipCode(value);
    } else if (field.id === 'cpf') {
        isValid = validateCPF(value);
    } else if (field.id === 'phone') {
        isValid = validatePhone(value);
    } else if (field.required) {
        isValid = value !== '';
    }
    
    if (!isValid) {
        field.classList.add('error');
        field.classList.remove('success');
        if (errorEl) errorEl.classList.add('show');
    } else {
        field.classList.remove('error');
        field.classList.add('success');
        if (errorEl) errorEl.classList.remove('show');
    }
    
    return isValid;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateZipCode(zip) {
    return /^\d{5}-\d{3}$/.test(zip) || /^\d{8}$/.test(zip);
}

function validatePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 11;
}

function validateCPF(cpf) {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return false;
    if (/^(\d)\1+$/.test(digits)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(digits.substring(i-1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(digits.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(digits.substring(i-1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(digits.substring(10, 11))) return false;
    
    return true;
}

function updateShippingCost() {
    const shippingEl = document.querySelector(".sidebar .total-row:nth-child(2) span:last-child");
    const mobileShippingEl = document.querySelector("#summaryContent .total-row:nth-child(2) span:nth-child(2)");
    const totalEl = document.querySelector(".sidebar .total-row.final span:last-child");
    const mobileTotalEl = document.querySelector("#summaryContent .total-row.final span:nth-child(2)");
    
    let shippingCost = 0;
    if (selectedShipping === 'express') {
        shippingCost = 25.00;
    } else if (selectedShipping === 'standard') {
        shippingCost = 15.00;
    }
    
    const total = cartData.subtotal + shippingCost;
    
    if (shippingEl) shippingEl.textContent = shippingCost === 0 ? "Grátis" : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`;
    if (mobileShippingEl) mobileShippingEl.textContent = shippingCost === 0 ? "Grátis" : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`;
    
    if (totalEl) totalEl.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
    if (mobileTotalEl) mobileTotalEl.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
    
    const mobileTotalPrice = document.getElementById("mobileTotalPrice");
    if (mobileTotalPrice) {
        mobileTotalPrice.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
    }
}

function selectPayment() {
    const method = this.closest('.payment-method');
    document.querySelectorAll('.payment-method').forEach(m => {
        m.classList.remove('selected');
    });
    method.classList.add('selected');
    selectedPayment = method.dataset.payment;
    
    const creditCardNotice = document.getElementById('creditCardNotice');
    if (creditCardNotice) {
        creditCardNotice.style.display = selectedPayment === 'credit_card' ? 'block' : 'none';
    }
}

function updateProgress() {
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        if (index + 1 < currentStep) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else if (index + 1 === currentStep) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });
}

async function handleDeliverySubmit(e) {
    e.preventDefault();
    
    // Coleta dados
    const formData = new FormData(e.target);
    window.checkoutData.delivery = Object.fromEntries(formData.entries());
    window.checkoutData.delivery.shipping = selectedShipping;
    
    // Avança para pagamento
    document.getElementById('stepDelivery').classList.add('hidden');
    document.getElementById('stepPayment').classList.remove('hidden');
    currentStep = 3;
    updateProgress();
    window.scrollTo(0, 0);
}

async function handlePaymentSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processando...';
    
    try {
        // Simulação de processamento
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (selectedPayment === 'pix') {
            showPixModal();
        } else {
            alert('Pedido realizado com sucesso!');
        }
    } catch (error) {
        alert('Erro ao processar pagamento. Tente novamente.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function showPixModal() {
    const modal = document.getElementById('pixModal');
    modal.classList.add('show');
    startPixTimer(900); // 15 minutos
}

function startPixTimer(duration) {
    let timer = duration;
    const display = document.getElementById('pixTimer');
    
    if (pixTimer) clearInterval(pixTimer);
    
    pixTimer = setInterval(() => {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        
        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (--timer < 0) {
            clearInterval(pixTimer);
            display.textContent = "Expirado";
        }
    }, 1000);
}

function closePixModal() {
    document.getElementById('pixModal').classList.remove('show');
    if (pixTimer) clearInterval(pixTimer);
}

function copyPixCode() {
    const code = "00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865802BR5913MANUS STORE6009SAO PAULO62070503***6304E2B4";
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Copiado!';
        setTimeout(() => btn.innerHTML = originalText, 2000);
    });
}
