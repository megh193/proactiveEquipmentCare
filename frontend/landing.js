/* ===================================================
   LANDING PAGE JS — Proactive Equipment Care
   =================================================== */

/* ----- Navbar scroll effect ----- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

/* ----- Gauge animation ----- */
const GAUGE_ARC = 267; // stroke-dasharray value (≈ π * 85)
const TARGET_PERCENT = 67;

function animateGauge() {
    const fill = document.getElementById('gaugeFill');
    const text = document.getElementById('gaugeText');
    if (!fill || !text) return;

    let startTime = null;
    const duration = 1800;

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);

        const currentPct = Math.round(eased * TARGET_PERCENT);
        const dashOffset = GAUGE_ARC * (1 - (eased * TARGET_PERCENT) / 100);

        fill.setAttribute('stroke-dashoffset', dashOffset.toFixed(2));
        text.textContent = currentPct + '%';

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    // Delay slightly for visual impact
    setTimeout(() => requestAnimationFrame(step), 600);
}

/* ----- Motor bar animation ----- */
function animateMotorBars() {
    const bars = document.querySelectorAll('.motor-bar[data-target]');
    bars.forEach((bar, i) => {
        const target = parseInt(bar.getAttribute('data-target'));
        setTimeout(() => {
            bar.style.width = target + '%';
        }, 700 + i * 120);
    });
}

/* ----- Hero mini stats counter ----- */
function animateHeroStats() {
    const el = document.getElementById('stat-accuracy');
    const el2 = document.getElementById('stat-params');
    if (el) {
        setTimeout(() => {
            let v = 0;
            const timer = setInterval(() => {
                v += 3.1;
                if (v >= 99.2) { v = 99.2; clearInterval(timer); }
                el.textContent = v.toFixed(1) + '%';
            }, 30);
        }, 400);
    }
    if (el2) {
        setTimeout(() => {
            let v = 0;
            const timer = setInterval(() => {
                v++;
                if (v >= 5) { v = 5; clearInterval(timer); }
                el2.textContent = v;
            }, 200);
        }, 400);
    }
}

/* ----- IntersectionObserver for scroll animations ----- */
const observerOptions = { threshold: 0.15, rootMargin: '0px 0px -40px 0px' };

const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const delay = parseInt(entry.target.getAttribute('data-delay') || '0');
            setTimeout(() => entry.target.classList.add('visible'), delay);
            cardObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

function setupScrollAnimations() {
    document.querySelectorAll('.feat-card, .hiw-step, .tech-stat-card').forEach(el => {
        cardObserver.observe(el);
    });
}

/* ----- Tech stat counters (triggered on scroll) ----- */
function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'));
    const suffix = el.getAttribute('data-suffix') || '';
    if (isNaN(target)) return;

    let start = 0;
    const duration = 1500;
    const startTime = performance.now();

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function step(timestamp) {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutExpo(progress);
        const current = Math.round(eased * target);
        el.textContent = current.toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const counters = entry.target.querySelectorAll('[data-count]');
            counters.forEach(c => animateCounter(c));
            counterObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

/* ----- Smooth scroll for anchor links ----- */
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

/* ----- Hero card tilt effect on mouse move ----- */
const heroCard = document.getElementById('heroCard');
if (heroCard) {
    const heroRight = heroCard.closest('.hero-right');
    if (heroRight) {
        heroRight.addEventListener('mousemove', (e) => {
            const rect = heroRight.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            heroCard.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
        });
        heroRight.addEventListener('mouseleave', () => {
            heroCard.style.transform = 'perspective(800px) rotateY(0) rotateX(0) translateY(0)';
            heroCard.style.transition = 'transform 0.5s ease';
        });
        heroRight.addEventListener('mousemove', () => {
            heroCard.style.transition = 'transform 0.1s ease';
        });
    }
}

/* ----- Init ----- */
document.addEventListener('DOMContentLoaded', () => {
    animateGauge();
    animateMotorBars();
    animateHeroStats();
    setupScrollAnimations();

    const techSection = document.querySelector('.tech-sec');
    if (techSection) counterObserver.observe(techSection);
});