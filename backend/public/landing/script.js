// Apple-inspired Landing Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    
    // ---- Mobile Menu Functionality ---- //
    const hamburger = document.querySelector('.hamburger');
    const mobileSheet = document.querySelector('.mobile-sheet');
    let mobileMenuOpen = false;

    if (hamburger && mobileSheet) {
        hamburger.addEventListener('click', function(e) {
            e.preventDefault();
            toggleMobileMenu();
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (mobileMenuOpen && !hamburger.contains(e.target) && !mobileSheet.contains(e.target)) {
                closeMobileMenu();
            }
        });

        // Close mobile menu on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mobileMenuOpen) {
                closeMobileMenu();
            }
        });

        // Close mobile menu when clicking on links
        mobileSheet.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                closeMobileMenu();
            });
        });
    }

    function toggleMobileMenu() {
        if (mobileMenuOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }

    function openMobileMenu() {
        mobileMenuOpen = true;
        mobileSheet.hidden = false;
        mobileSheet.classList.add('open');
        hamburger.setAttribute('aria-expanded', 'true');
        
        // Animate hamburger to X
        hamburger.classList.add('active');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        mobileMenuOpen = false;
        mobileSheet.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        
        // Animate hamburger back to lines
        hamburger.classList.remove('active');
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Hide after animation completes
        setTimeout(() => {
            if (!mobileMenuOpen) {
                mobileSheet.hidden = true;
            }
        }, 400);
    }

    // ---- Smooth Scrolling ---- //
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerHeight = 100; // Account for sticky header
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ---- Enhanced Scroll Effects ---- //
    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateOnScroll() {
        const scrollY = window.scrollY;
        const nav = document.querySelector('.nav');
        
        // Add scrolled class for enhanced backdrop blur
        if (scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        lastScrollY = scrollY;
        ticking = false;
    }

    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateOnScroll);
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestTick, { passive: true });

    // ---- Intersection Observer for Animations ---- //
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                
                // For glass cards, add staggered animation
                if (entry.target.classList.contains('glass-card')) {
                    const cards = Array.from(document.querySelectorAll('.glass-card'));
                    const index = cards.indexOf(entry.target);
                    entry.target.style.animationDelay = `${index * 0.1}s`;
                }
            }
        });
    }, observerOptions);

    // Observe elements for animations
    const animatedElements = document.querySelectorAll('.glass-card, .glass-pane, .mock');
    animatedElements.forEach(el => {
        observer.observe(el);
    });

    // ---- Enhanced Button Interactions ---- //
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
        
        button.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(-1px) scale(0.98)';
        });
        
        button.addEventListener('mouseup', function() {
            this.style.transform = 'translateY(-3px)';
        });
    });

    // ---- Glass Card Hover Effects ---- //
    document.querySelectorAll('.glass-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            // Add subtle parallax effect
            this.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // ---- Reduce Motion for Accessibility ---- //
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
        // Disable animations for users who prefer reduced motion
        const style = document.createElement('style');
        style.textContent = `
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ---- Analytics Tracking ---- //
    function trackEvent(category, action, label) {
        // Google Analytics 4 tracking
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                event_category: category,
                event_label: label
            });
        }
    }

    // Track CTA clicks
    document.querySelectorAll('.btn.primary').forEach(button => {
        button.addEventListener('click', function() {
            trackEvent('CTA', 'click', 'Primary Button');
        });
    });

    document.querySelectorAll('.btn.glass').forEach(button => {
        button.addEventListener('click', function() {
            trackEvent('CTA', 'click', 'Secondary Button');
        });
    });

    document.querySelectorAll('.link').forEach(link => {
        link.addEventListener('click', function() {
            trackEvent('Navigation', 'click', 'Section Link');
        });
    });

    // ---- Footer Year Update ---- //
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // ---- Keyboard Navigation Enhancement ---- //
    document.addEventListener('keydown', function(e) {
        // Allow keyboard navigation for mobile menu
        if (e.key === 'Tab' && mobileMenuOpen) {
            const focusableElements = mobileSheet.querySelectorAll('a, button');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    });

    // ---- Performance Monitoring ---- //
    window.addEventListener('load', function() {
        // Report Core Web Vitals
        if ('performance' in window && 'PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.entryType === 'largest-contentful-paint') {
                        trackEvent('Performance', 'LCP', Math.round(entry.startTime));
                    }
                    if (entry.entryType === 'first-input') {
                        trackEvent('Performance', 'FID', Math.round(entry.processingStart - entry.startTime));
                    }
                });
            });
            
            observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });
        }
    });

    // ---- Theme Detection ---- //
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    function handleThemeChange(e) {
        // Update logo colors or other theme-specific elements if needed
        const logoGradient = document.querySelector('#g');
        if (logoGradient) {
            const stops = logoGradient.querySelectorAll('stop');
            if (e.matches) {
                // Dark theme
                stops[0].setAttribute('stop-color', '#007AFF');
                stops[1].setAttribute('stop-color', '#0056CC');
            } else {
                // Light theme
                stops[0].setAttribute('stop-color', '#007AFF');
                stops[1].setAttribute('stop-color', '#0056CC');
            }
        }
    }

    darkModeQuery.addEventListener('change', handleThemeChange);
    handleThemeChange(darkModeQuery); // Initial call

    // ---- Enhanced Focus Management ---- //
    let focusOutlineVisible = false;
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            focusOutlineVisible = true;
            document.body.classList.add('focus-visible');
        }
    });
    
    document.addEventListener('mousedown', function() {
        focusOutlineVisible = false;
        document.body.classList.remove('focus-visible');
    });

    // ---- Preload Critical Resources ---- //
    const criticalImages = [
        // Add any critical images that should be preloaded
    ];

    criticalImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
    });

    // ---- Console Welcome Message ---- //
    console.log('%cStaylabel Landing Page', 'font-size: 20px; font-weight: bold; color: #007AFF;');
    console.log('%cBuilt with ❤️ for aparthotel owners and guests', 'font-size: 14px; color: #6e6e73;');
    
});

// ---- Additional CSS for hamburger animation ---- //
const hamburgerStyles = `
.hamburger.active span:nth-child(1) {
    transform: rotate(45deg) translate(5px, 5px);
}

.hamburger.active span:nth-child(2) {
    opacity: 0;
}

.hamburger.active span:nth-child(3) {
    transform: rotate(-45deg) translate(7px, -6px);
}

.nav.scrolled {
    backdrop-filter: saturate(180%) blur(25px);
    background: rgba(250, 250, 250, 0.98);
    border-bottom-color: rgba(0, 0, 0, 0.08);
}

.focus-visible .btn:focus-visible,
.focus-visible .nav-links a:focus-visible,
.focus-visible .link:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 4px;
}

.glass-card {
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
`;

// Inject hamburger styles
const styleSheet = document.createElement('style');
styleSheet.textContent = hamburgerStyles;
document.head.appendChild(styleSheet);
